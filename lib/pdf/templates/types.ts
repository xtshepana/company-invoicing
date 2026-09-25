import type { DocumentData } from "@/lib/pdf/document-data";
import type { CompanySettings } from "@/lib/config/system-settings";

export interface TemplateProps {
  data: DocumentData;
  settings: CompanySettings;
}

/** Every template falls back to this when the company hasn't picked a brand color, so accent-driven templates (modern/bold) still look designed out of the box. */
export const DEFAULT_ACCENT_COLOR = "#2563eb";
