// =============================================================================
// Geo helpers — distance privacy
// We expose only H3 cell + snapped distance to clients. Real coords stay server-side.
// =============================================================================
import { latLngToCell, cellToBoundary } from "h3-js";

export const H3_RESOLUTION = 8; // ~0.46 mi² hex, ~460m edge

export function coarseCell(lat: number, lng: number): string {
  return latLngToCell(lat, lng, H3_RESOLUTION);
}

export function cellPolygon(h3: string): [number, number][] {
  return cellToBoundary(h3, false) as [number, number][];
}

export function formatDistance(mi: number | null | undefined): string {
  if (mi == null) return "—";
  if (mi < 0.1) return "<0.1 mi";
  if (mi < 10) return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}
