export const BRAND_COLOR_PRESETS = [
  { name: "Blue", hex: "#2563eb" },
  { name: "Green", hex: "#16a34a" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Orange", hex: "#ea580c" },
  { name: "Teal", hex: "#0d9488" },
] as const;

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** WCAG relative-luminance based black/white pick for text over a solid `hex` background. */
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.45 ? "#000000" : "#ffffff";
}

/** Mixes `hex` toward white by `amount` (0-1) — used for subtle tinted backgrounds (e.g. a table header row) that still read as the brand color without needing alpha compositing, which PDF renderers handle inconsistently. */
export function tintColor(hex: string, amount: number): string {
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  const r = mix(parseInt(hex.slice(1, 3), 16));
  const g = mix(parseInt(hex.slice(3, 5), 16));
  const b = mix(parseInt(hex.slice(5, 7), 16));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
