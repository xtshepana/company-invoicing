import { ClassicTemplate } from "@/lib/pdf/templates/classic";
import { ModernTemplate } from "@/lib/pdf/templates/modern";
import { MinimalTemplate } from "@/lib/pdf/templates/minimal";
import { BoldTemplate } from "@/lib/pdf/templates/bold";
import { ElegantTemplate } from "@/lib/pdf/templates/elegant";
import type { TemplateProps } from "@/lib/pdf/templates/types";

export const PDF_TEMPLATE_COMPONENTS: Record<string, (props: TemplateProps) => React.JSX.Element> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  elegant: ElegantTemplate,
};

export const PDF_TEMPLATE_LABELS: Record<string, string> = {
  classic: "Classic",
  modern: "Modern",
  minimal: "Minimal",
  bold: "Bold",
  elegant: "Elegant",
};

export function resolvePdfTemplate(templateKey: string): (props: TemplateProps) => React.JSX.Element {
  return PDF_TEMPLATE_COMPONENTS[templateKey] ?? ClassicTemplate;
}
