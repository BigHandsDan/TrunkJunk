// =============================================================================
// redact-message: scrub PII before storing chat messages
//
// 1. Regex pass for phones, emails, URLs, social handles, addresses
// 2. Block payment-platform keywords (Venmo, Zelle, CashApp, PayPal F&F)
// 3. Optional LLM second pass for paraphrased/phonetic PII
// 4. Persist redacted body + audit copy of original
// =============================================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceClient, userClient } from "../_shared/supabase.ts";

const PATTERNS: Record<string, RegExp> = {
  phone: /(\+?\d[\d\s().\-]{8,}\d)/g,
  email: /([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})/gi,
  url: /\b((?:https?:\/\/|www\.)\S+)\b/gi,
  social: /(@[A-Za-z0-9_.]{3,})/g,
  address:
    /\b\d{1,5}\s+([A-Z][a-z]+\s){1,4}(St|Ave|Blvd|Rd|Dr|Ln|Way|Ct|Pl|Hwy|Pkwy)\b/g,
};

const OFF_PLATFORM_KEYWORDS = [
  "venmo",
  "zelle",
  "cashapp",
  "cash app",
  "paypal",
  "paypal f&f",
  "friends and family",
  "wire transfer",
  "bitcoin",
  "btc",
  "western union",
  "moneygram",
];

interface Redaction {
  clean: string;
  counts: Record<string, number>;
  flagged: boolean;
}

function redactRegex(input: string): Redaction {
  let out = input;
  const counts: Record<string, number> = {};
  let flagged = false;
  for (const [kind, re] of Object.entries(PATTERNS)) {
    const matches = out.match(re);
    counts[kind] = matches?.length ?? 0;
    if (matches && matches.length > 0) flagged = true;
    out = out.replace(re, `[${kind.toUpperCase()} HIDDEN]`);
  }
  // Off-platform keyword filter
  const lower = out.toLowerCase();
  let kwHits = 0;
  for (const kw of OFF_PLATFORM_KEYWORDS) {
    if (lower.includes(kw)) {
      kwHits += 1;
      const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      out = out.replace(re, "[PAYMENT REF HIDDEN]");
    }
  }
  counts["off_platform_kw"] = kwHits;
  if (kwHits > 0) flagged = true;
  return { clean: out, counts, flagged };
}

async function llmPiiCheck(text: string): Promise<{ has_pii: boolean; reasons: string[] }> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key || text.length < 40) return { has_pii: false, reasons: [] };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_REDACTION_MODEL") ?? "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content:
              "Return strict JSON {\"has_pii\": boolean, \"reasons\": string[]}. Flag any phone number, email, street address, social handle, OR attempt to move conversation off-platform (e.g., 'meet at my house', 'text me at three oh five', 'venmo me'), including phonetic or spaced digits.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return { has_pii: false, reasons: [] };
    const json = await res.json();
    return JSON.parse(json.choices[0].message.content);
  } catch {
    return { has_pii: false, reasons: [] };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const { thread_id, body } = await req.json();
    if (!thread_id || typeof body !== "string" || body.length === 0) {
      return new Response("Bad Request", { status: 400, headers: corsHeaders });
    }

    // Verify caller is a participant
    const user = userClient(auth);
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const svc = serviceClient();
    const { data: thread, error: tErr } = await svc
      .from("threads")
      .select("id, seller_id, buyer_id, state")
      .eq("id", thread_id)
      .single();
    if (tErr || !thread) {
      return new Response("Thread not found", { status: 404, headers: corsHeaders });
    }
    if (thread.seller_id !== u.id && thread.buyer_id !== u.id) {
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }
    if (thread.state === "closed") {
      return new Response("Thread closed", { status: 409, headers: corsHeaders });
    }

    // Redact
    let redaction = redactRegex(body);
    const llm = await llmPiiCheck(body);
    if (llm.has_pii && !redaction.flagged) {
      redaction = {
        clean: "[MESSAGE BLOCKED — possible contact info or off-platform payment reference]",
        counts: { ...redaction.counts, llm_flagged: 1 },
        flagged: true,
      };
    }

    // Hard reject if message is just contact info with nothing else
    if (redaction.clean.replace(/\[.+?\]/g, "").trim().length < 3 && redaction.flagged) {
      return new Response(
        JSON.stringify({ error: "Message contains only contact info; please rephrase." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert message with service role, then audit row
    const { data: msg, error: mErr } = await svc
      .from("messages")
      .insert({
        thread_id,
        sender_id: u.id,
        body_clean: redaction.clean,
        redactions: redaction.counts,
        flagged: redaction.flagged,
      })
      .select("id, body_clean, created_at, flagged")
      .single();
    if (mErr) {
      return new Response(JSON.stringify({ error: mErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await svc.from("messages_audit").insert({ message_id: msg.id, body_raw: body });

    return new Response(JSON.stringify({ message: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
