import "./globals.css";
import Link from "next/link";

export const metadata = { title: "TrunkJunk Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="header">
          <h1>TrunkJunk Admin</h1>
          <nav>
            <Link href="/">Dashboard</Link>
            <Link href="/reports">Reports</Link>
            <Link href="/users">Users</Link>
            <Link href="/disputes">Disputes</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
