import { StyleSheet } from "@react-pdf/renderer";

export const pdfStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  companyName: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  logo: {
    maxWidth: 140,
    maxHeight: 50,
    marginBottom: 8,
    objectFit: "contain",
  },
  small: {
    fontSize: 8,
    color: "#555555",
    lineHeight: 1.4,
  },
  docTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 8,
    color: "#555555",
    textAlign: "right",
  },
  metaValue: {
    fontSize: 9,
    textAlign: "right",
    marginBottom: 3,
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontSize: 8,
    color: "#888888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  billToBlock: {
    marginBottom: 20,
  },
  billToName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  table: {
    marginTop: 8,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1px solid #1a1a1a",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #e5e5e5",
    paddingVertical: 5,
  },
  th: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    color: "#555555",
  },
  colDescription: { width: "40%" },
  colQty: { width: "10%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colDiscount: { width: "10%", textAlign: "right" },
  colVat: { width: "10%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  totalsBlock: {
    marginTop: 12,
    marginLeft: "auto",
    width: 220,
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  totalsRowFinal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTop: "1px solid #1a1a1a",
  },
  totalsLabel: {
    color: "#555555",
  },
  totalsValueFinal: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  twoColumn: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    gap: 20,
  },
  block: {
    width: "48%",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#888888",
    borderTop: "1px solid #e5e5e5",
    paddingTop: 8,
  },
  statusBadge: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
    textAlign: "right",
    textTransform: "uppercase",
  },
});

/** Per-document style overrides driven by company_settings.brand_color — {} when unset, so the defaults above apply untouched. */
export function pdfAccentStyles(brandColor: string | null) {
  if (!brandColor) return {};
  return {
    docTitle: { color: brandColor },
    tableHeaderRow: { borderBottomColor: brandColor },
    totalsRowFinal: { borderTopColor: brandColor },
    totalsValueFinal: { color: brandColor },
  };
}
