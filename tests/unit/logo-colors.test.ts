import { describe, expect, it } from "vitest";
import { parseBrandColorField, pickBrandColors } from "@/lib/branding/logo-colors";
import { appearanceSchema } from "@/lib/validations/company-settings";
import { rgbToHex, shadeColor } from "@/lib/color-utils";

type Rgba = [number, number, number, number];
const CYAN: Rgba = [0, 178, 227, 255];
const GREY: Rgba = [119, 119, 119, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const RED: Rgba = [220, 38, 38, 255];
const BLUE: Rgba = [37, 99, 235, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const CLEAR: Rgba = [0, 0, 0, 0];

/** A flat RGBA pixel array built from [colour, how many pixels] runs. */
function pixels(...runs: [Rgba, number][]): Uint8ClampedArray {
  const total = runs.reduce((sum, [, n]) => sum + n, 0);
  const out = new Uint8ClampedArray(total * 4);
  let at = 0;
  for (const [colour, n] of runs) {
    for (let i = 0; i < n; i++) {
      out.set(colour, at);
      at += 4;
    }
  }
  return out;
}

describe("pickBrandColors", () => {
  it("picks the main colour and the next distinct colour, ignoring a transparent background", () => {
    expect(pickBrandColors(pixels([CYAN, 600], [GREY, 250], [CLEAR, 150]))).toEqual({ primary: "#00b2e3", secondary: "#777777" });
  });

  it("ignores a white background", () => {
    expect(pickBrandColors(pixels([CYAN, 600], [GREY, 250], [WHITE, 4000]))).toEqual({ primary: "#00b2e3", secondary: "#777777" });
  });

  it("uses the real shade, not one dulled by lighter anti-aliased edge pixels", () => {
    const edge: Rgba = [140, 220, 240, 255]; // a lighter cyan from the edge of a letter
    const result = pickBrandColors(pixels([CYAN, 600], [edge, 60], [GREY, 250], [WHITE, 1000]));
    expect(result.primary).toBe("#00b2e3");
  });

  it("returns nothing for an image that is all white or all transparent", () => {
    expect(pickBrandColors(pixels([WHITE, 500]))).toEqual({ primary: null, secondary: null });
    expect(pickBrandColors(pixels([CLEAR, 500]))).toEqual({ primary: null, secondary: null });
    expect(pickBrandColors(new Uint8ClampedArray(0))).toEqual({ primary: null, secondary: null });
  });

  it("leaves the secondary empty for a one-colour logo", () => {
    expect(pickBrandColors(pixels([CYAN, 800], [WHITE, 500]))).toEqual({ primary: "#00b2e3", secondary: null });
  });

  it("does not offer a near-identical shade as the secondary colour", () => {
    const nearBlue: Rgba = [37, 110, 235, 255];
    expect(pickBrandColors(pixels([BLUE, 700], [nearBlue, 300])).secondary).toBeNull();
  });

  it("picks two clearly different colours", () => {
    expect(pickBrandColors(pixels([RED, 300], [BLUE, 700]))).toEqual({ primary: "#2563eb", secondary: "#dc2626" });
  });

  it("works for a greyscale logo", () => {
    expect(pickBrandColors(pixels([BLACK, 700], [GREY, 300]))).toEqual({ primary: "#000000", secondary: "#777777" });
  });

  it("ranks colour above grey, so a coloured logo gets a coloured primary", () => {
    // more grey pixels than cyan pixels, but grey counts for half
    expect(pickBrandColors(pixels([GREY, 600], [CYAN, 450]))).toEqual({ primary: "#00b2e3", secondary: "#777777" });
  });

  it("ignores specks that cover too little of the artwork to be a brand colour", () => {
    expect(pickBrandColors(pixels([CYAN, 980], [RED, 12])).secondary).toBeNull();
  });
});

describe("colour helpers", () => {
  it("rgbToHex pads, rounds and clamps", () => {
    expect(rgbToHex(0, 178, 227)).toBe("#00b2e3");
    expect(rgbToHex(1, 2, 3)).toBe("#010203");
    expect(rgbToHex(-5, 300, 127.6)).toBe("#00ff80");
  });

  it("shadeColor mixes toward black", () => {
    expect(shadeColor("#ffffff", 0)).toBe("#ffffff");
    expect(shadeColor("#ffffff", 1)).toBe("#000000");
    expect(shadeColor("#00b2e3", 0.5)).toBe("#005972");
  });
});

describe("parseBrandColorField (the colours posted with a logo upload)", () => {
  it("accepts a hex colour, trimmed and lower-cased", () => {
    expect(parseBrandColorField("#02B0E2")).toBe("#02b0e2");
    expect(parseBrandColorField("  #02b0e2 ")).toBe("#02b0e2");
  });

  it("ignores anything that is not a full #rrggbb value", () => {
    for (const bad of ["", "red", "#fff", "02b0e2", "#02b0e2; background:url(x)", "#02b0e2zz"]) expect(parseBrandColorField(bad), bad).toBeNull();
    expect(parseBrandColorField(null)).toBeNull();
    expect(parseBrandColorField(new File(["x"], "logo.png"))).toBeNull();
  });
});

describe("appearanceSchema brand colours", () => {
  const base = { brand_color: "", brand_color_secondary: "", pdf_template: "corporate", show_company_name: false };

  it("accepts a primary and a secondary colour", () => {
    const result = appearanceSchema.parse({ ...base, brand_color: "#02b0e2", brand_color_secondary: "#737373" });
    expect(result.brand_color).toBe("#02b0e2");
    expect(result.brand_color_secondary).toBe("#737373");
  });

  it("turns an empty colour into null, so it can be cleared", () => {
    const result = appearanceSchema.parse(base);
    expect(result.brand_color).toBeNull();
    expect(result.brand_color_secondary).toBeNull();
  });

  it("rejects a secondary colour that is not a hex value", () => {
    expect(appearanceSchema.safeParse({ ...base, brand_color_secondary: "grey" }).success).toBe(false);
    expect(appearanceSchema.safeParse({ ...base, brand_color_secondary: "#12345" }).success).toBe(false);
  });
});
