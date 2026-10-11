import { HEX_COLOR_PATTERN, rgbToHex } from "@/lib/color-utils";

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
}

interface Bucket {
  count: number;
  chromatic: boolean;
  hue: number;
  /** Counts per quantised exact colour, so the bucket's colour is its most common real shade rather than an average dulled by anti-aliased edge pixels. */
  shades: Map<number, { n: number; r: number; g: number; b: number }>;
}

const MIN_ALPHA = 160; // ignore transparent / mostly transparent pixels
const WHITE_FLOOR = 235; // every channel at least this = background white
const HUE_STEP = 24; // 15 hue families
const MIN_SHARE_OF_PIXELS = 0.04; // a secondary colour must cover at least 4% of the artwork
const MIN_SHARE_OF_PRIMARY = 0.12;
const MIN_HUE_DISTANCE = 36;
const GREY_WEIGHT = 0.5; // greys and blacks count for less than colour when ranking, so a coloured logo gets coloured brand colours

function hueOf(r: number, g: number, b: number, max: number, min: number): number {
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function dominantShade(bucket: Bucket): string {
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const shade of bucket.shades.values()) if (!best || shade.n > best.n) best = shade;
  return rgbToHex(Math.round(best!.r / best!.n), Math.round(best!.g / best!.n), Math.round(best!.b / best!.n));
}

/**
 * Picks a logo's two main brand colours from its RGBA pixels (a flat array, 4 values per pixel).
 * Transparent and near-white pixels are ignored, colour outranks grey/black, and the secondary colour has to be
 * clearly different from the primary - otherwise it is left null and the templates derive one from the primary.
 */
export function pickBrandColors(pixels: ArrayLike<number>): BrandColors {
  const buckets = new Map<string, Bucket>();
  let counted = 0;

  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if (pixels[i + 3] < MIN_ALPHA) continue;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (min >= WHITE_FLOOR) continue;

    const value = max / 255;
    const saturation = max === 0 ? 0 : (max - min) / max;
    const chromatic = saturation >= 0.25 && value >= 0.2;
    const hue = chromatic ? hueOf(r, g, b, max, min) : 0;
    const key = chromatic ? `c${Math.floor(hue / HUE_STEP)}` : `n${value < 0.25 ? 0 : value < 0.6 ? 1 : 2}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { count: 0, chromatic, hue, shades: new Map() };
      buckets.set(key, bucket);
    }
    bucket.count++;
    counted++;
    const shadeKey = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const shade = bucket.shades.get(shadeKey);
    if (shade) {
      shade.n++;
      shade.r += r;
      shade.g += g;
      shade.b += b;
    } else {
      bucket.shades.set(shadeKey, { n: 1, r, g, b });
    }
  }

  if (counted === 0) return { primary: null, secondary: null };

  const score = (bucket: Bucket) => bucket.count * (bucket.chromatic ? 1 : GREY_WEIGHT);
  const ranked = [...buckets.values()].sort((a, b) => score(b) - score(a));
  const primaryBucket = ranked[0];

  const secondaryBucket = ranked.slice(1).find((candidate) => {
    if (candidate.count < counted * MIN_SHARE_OF_PIXELS) return false;
    if (candidate.count < primaryBucket.count * MIN_SHARE_OF_PRIMARY) return false; // plain pixel counts, so a grey that covers a fair share still qualifies
    if (primaryBucket.chromatic && candidate.chromatic) return hueDistance(primaryBucket.hue, candidate.hue) >= MIN_HUE_DISTANCE;
    return true; // colour with grey, or grey with colour, is already clearly different
  });

  return {
    primary: dominantShade(primaryBucket),
    secondary: secondaryBucket ? dominantShade(secondaryBucket) : null,
  };
}

/**
 * Browser only: decodes an uploaded logo (PNG, JPEG, WEBP or SVG) onto a small canvas and picks its colours.
 * Returns nulls (never throws) when the image can't be read, so an upload is never blocked by colour picking.
 */
export async function readLogoColors(file: File): Promise<BrandColors> {
  const none: BrandColors = { primary: null, secondary: null };
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("unreadable image"));
      image.src = url;
    });
    const naturalWidth = image.naturalWidth || 256;
    const naturalHeight = image.naturalHeight || 256;
    const scale = Math.min(1, 160 / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return none;
    context.drawImage(image, 0, 0, width, height);
    return pickBrandColors(context.getImageData(0, 0, width, height).data);
  } catch {
    return none;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A brand colour posted from the logo form: a valid #rrggbb (lower-cased) or null. Anything else is ignored, never stored. */
export function parseBrandColorField(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim()) ? value.trim().toLowerCase() : null;
}
