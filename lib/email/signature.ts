import { HEX_COLOR_PATTERN } from "@/lib/color-utils";
import { escapeHtml } from "@/lib/email/escape";

export interface EmailSignature {
  companyName: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  website: string;
  addressPhysical: string;
  registrationNumber: string;
  vatNumber: string;
  brandColor: string | null;
}

/** The slice of company_settings the signature reads, so it always matches the Settings > Company profile page. */
export interface SignatureSource {
  company_name: string;
  logo_url: string | null;
  phone: string;
  email: string;
  website: string;
  address_physical: string;
  registration_number: string;
  vat_number: string;
  brand_color: string | null;
}

export function emailSignatureFromSettings(settings: SignatureSource): EmailSignature {
  return {
    companyName: settings.company_name,
    logoUrl: settings.logo_url,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    addressPhysical: settings.address_physical,
    registrationNumber: settings.registration_number,
    vatNumber: settings.vat_number,
    brandColor: settings.brand_color,
  };
}

/** Staff type this in by hand, so only ever turn it into a link if it's clearly a web address. */
function websiteHref(website: string): string | null {
  const value = website.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(value)) return `https://${value}`;
  return null;
}

function line(label: string, valueHtml: string): string {
  return `<span style="color: #888;">${label}</span>&nbsp; ${valueHtml}<br>`;
}

/**
 * "Kind regards" plus the company's details, for the customer-facing emails
 * only (never the sign-in link or internal notices). Fields left blank on
 * the company profile are simply left out, and every value is escaped since
 * it all comes from free-text settings.
 */
export function signatureHtml(signature: EmailSignature): string {
  const accent = signature.brandColor && HEX_COLOR_PATTERN.test(signature.brandColor) ? signature.brandColor : "#1a1a1a";
  const name = escapeHtml(signature.companyName);

  const logo =
    signature.logoUrl && /^https:\/\//i.test(signature.logoUrl)
      ? `<img src="${escapeHtml(signature.logoUrl)}" alt="${name}" style="display: block; max-height: 48px; max-width: 180px; margin-bottom: 8px;"><br>`
      : "";

  const rows: string[] = [];
  const phone = signature.phone.trim();
  if (phone) rows.push(line("Tel", escapeHtml(phone)));

  const email = signature.email.trim();
  if (email) rows.push(line("Email", `<a href="mailto:${escapeHtml(email)}" style="color: ${accent}; text-decoration: none;">${escapeHtml(email)}</a>`));

  const website = signature.website.trim();
  if (website) {
    const href = websiteHref(website);
    const shown = escapeHtml(website.replace(/^https?:\/\//i, "").replace(/\/$/, ""));
    rows.push(line("Web", href ? `<a href="${escapeHtml(href)}" style="color: ${accent}; text-decoration: none;">${shown}</a>` : shown));
  }

  const address = signature.addressPhysical
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");
  if (address) rows.push(line("Address", address));

  const registration = [
    signature.registrationNumber.trim() ? `Reg. ${escapeHtml(signature.registrationNumber.trim())}` : "",
    signature.vatNumber.trim() ? `VAT ${escapeHtml(signature.vatNumber.trim())}` : "",
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `
    <div style="margin-top: 28px; font-size: 13px; line-height: 1.6; color: #444;">
      <div style="margin-bottom: 10px;">Kind regards,</div>
      <div style="border-top: 3px solid ${accent}; padding-top: 12px; max-width: 360px;">
        ${logo}
        <strong style="font-size: 14px; color: #1a1a1a;">${name}</strong><br>
        ${rows.join("\n        ")}
        ${registration ? `<span style="font-size: 12px; color: #888;">${registration}</span>` : ""}
      </div>
    </div>`;
}
