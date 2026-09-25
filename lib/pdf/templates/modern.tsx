import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/money";
import { readableTextColor, tintColor } from "@/lib/color-utils";
import { DEFAULT_ACCENT_COLOR, type TemplateProps } from "@/lib/pdf/templates/types";

/** Colored header band, tinted table header, and a boxed grand total - the most visually assertive of the set. */
export function ModernTemplate({ data, settings }: TemplateProps) {
  const currency = settings.default_currency;
  const accent = settings.brand_color ?? DEFAULT_ACCENT_COLOR;
  const onAccent = readableTextColor(accent);
  const tint = tintColor(accent, 0.9);
  const { customer } = data;

  const st = StyleSheet.create({
    page: { padding: 0, fontSize: 9, fontFamily: "Helvetica", color: "#1a1a1a" },
    body: { padding: 40, paddingTop: 24 },
    band: {
      backgroundColor: accent,
      color: onAccent,
      paddingHorizontal: 40,
      paddingVertical: 24,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    logo: { maxWidth: 120, maxHeight: 44, marginBottom: 6, objectFit: "contain" },
    companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", color: onAccent },
    companySmall: { fontSize: 8, color: onAccent, opacity: 0.9, lineHeight: 1.4 },
    docTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: onAccent, textAlign: "right" },
    statusBadge: {
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
      color: onAccent,
      textAlign: "right",
      textTransform: "uppercase",
      marginTop: 4,
    },
    metaRow: { flexDirection: "row", gap: 28, marginTop: 20, marginBottom: 20 },
    metaField: { flexDirection: "column" },
    metaLabel: { fontSize: 7, color: "#888888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
    metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
    billTo: { borderLeft: `3px solid ${accent}`, paddingLeft: 10, marginBottom: 20 },
    sectionTitle: { fontSize: 8, color: accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold" },
    billToName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    small: { fontSize: 8, color: "#555555", lineHeight: 1.4 },
    tableHeaderRow: {
      flexDirection: "row",
      backgroundColor: tint,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderRadius: 3,
      marginBottom: 4,
    },
    tableRow: { flexDirection: "row", borderBottom: "1px solid #eeeeee", paddingVertical: 6, paddingHorizontal: 8 },
    th: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: accent },
    colDescription: { width: "40%" },
    colQty: { width: "10%", textAlign: "right" },
    colPrice: { width: "15%", textAlign: "right" },
    colDiscount: { width: "10%", textAlign: "right" },
    colVat: { width: "10%", textAlign: "right" },
    colTotal: { width: "15%", textAlign: "right" },
    totalsBlock: { marginTop: 14, marginLeft: "auto", width: 230 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    totalsLabel: { color: "#555555" },
    grandTotalBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: accent,
      color: onAccent,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 3,
      marginTop: 6,
    },
    grandTotalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: onAccent },
    balanceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, marginTop: 6 },
    balanceLabelFinal: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    twoColumn: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, gap: 20 },
    block: { width: "48%" },
    footer: { position: "absolute", bottom: 0, left: 0, right: 0, height: 6, backgroundColor: accent },
  });

  return (
    <Document title={data.number}>
      <Page size="A4" style={st.page}>
        <View style={st.band}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
            {settings.logo_url ? <Image style={st.logo} src={settings.logo_url} /> : null}
            <Text style={st.companyName}>{settings.company_name}</Text>
            <Text style={st.companySmall}>{settings.address_physical}</Text>
            <Text style={st.companySmall}>{[settings.phone, settings.email].filter(Boolean).join("  ·  ")}</Text>
          </View>
          <View>
            <Text style={st.docTitle}>{data.docTitle}</Text>
            <Text style={[st.metaValue, { color: onAccent, textAlign: "right" }]}>{data.number}</Text>
            {data.statusLabel ? <Text style={st.statusBadge}>{data.statusLabel}</Text> : null}
          </View>
        </View>

        <View style={st.body}>
          <View style={st.metaRow}>
            {data.metaFields
              .filter((field) => field.value !== data.number)
              .map((field) => (
                <View key={field.label} style={st.metaField}>
                  <Text style={st.metaLabel}>{field.label}</Text>
                  <Text style={st.metaValue}>{field.value}</Text>
                </View>
              ))}
          </View>

          <View style={st.billTo}>
            <Text style={st.sectionTitle}>{data.billToLabel}</Text>
            <Text style={st.billToName}>{customer.name}</Text>
            {customer.accountNo ? <Text style={st.small}>Account No: {customer.accountNo}</Text> : null}
            {customer.contactPerson ? <Text style={st.small}>{customer.contactPerson}</Text> : null}
            {customer.address ? <Text style={st.small}>{customer.address}</Text> : null}
            {customer.email ? <Text style={st.small}>{customer.email}</Text> : null}
            {customer.vatNumber ? <Text style={st.small}>VAT No: {customer.vatNumber}</Text> : null}
          </View>

          <View>
            <View style={st.tableHeaderRow}>
              <Text style={[st.th, st.colDescription]}>Description</Text>
              <Text style={[st.th, st.colQty]}>Qty</Text>
              <Text style={[st.th, st.colPrice]}>Unit Price</Text>
              <Text style={[st.th, st.colDiscount]}>Disc %</Text>
              <Text style={[st.th, st.colVat]}>VAT %</Text>
              <Text style={[st.th, st.colTotal]}>Total</Text>
            </View>
            {data.lineItems.map((item, index) => (
              <View style={st.tableRow} key={index}>
                <Text style={st.colDescription}>{item.description}</Text>
                <Text style={st.colQty}>{item.quantity}</Text>
                <Text style={st.colPrice}>{formatCurrency(item.unitPrice, currency)}</Text>
                <Text style={st.colDiscount}>{item.discountPercent}%</Text>
                <Text style={st.colVat}>{item.vatRate}%</Text>
                <Text style={st.colTotal}>{formatCurrency(item.lineTotal, currency)}</Text>
              </View>
            ))}
          </View>

          <View style={st.totalsBlock}>
            <View style={st.totalsRow}>
              <Text style={st.totalsLabel}>Subtotal</Text>
              <Text>{formatCurrency(data.totals.subtotal, currency)}</Text>
            </View>
            <View style={st.totalsRow}>
              <Text style={st.totalsLabel}>Discount</Text>
              <Text>-{formatCurrency(data.totals.discount, currency)}</Text>
            </View>
            <View style={st.totalsRow}>
              <Text style={st.totalsLabel}>VAT</Text>
              <Text>{formatCurrency(data.totals.vat, currency)}</Text>
            </View>
            <View style={st.grandTotalBox}>
              <Text style={st.grandTotalLabel}>Total</Text>
              <Text style={st.grandTotalLabel}>{formatCurrency(data.totals.total, currency)}</Text>
            </View>
            {data.docKind === "invoice" ? (
              <>
                <View style={st.totalsRow}>
                  <Text style={st.totalsLabel}>Amount paid</Text>
                  <Text>{formatCurrency(data.totals.amountPaid ?? 0, currency)}</Text>
                </View>
                <View style={st.balanceRow}>
                  <Text style={st.balanceLabelFinal}>Balance due</Text>
                  <Text style={st.balanceLabelFinal}>{formatCurrency(data.totals.balanceDue ?? 0, currency)}</Text>
                </View>
              </>
            ) : null}
          </View>

          {data.docKind === "invoice" ? (
            <View style={st.twoColumn}>
              <View style={st.block}>
                <Text style={st.sectionTitle}>Banking Details</Text>
                <Text style={st.small}>{settings.bank_name}</Text>
                <Text style={st.small}>{settings.bank_account_name}</Text>
                <Text style={st.small}>Acc No: {settings.bank_account_number}</Text>
                <Text style={st.small}>Branch Code: {settings.bank_branch_code}</Text>
                <Text style={st.small}>Account Type: {settings.bank_account_type}</Text>
              </View>
              <View style={st.block}>
                {data.notes ? (
                  <>
                    <Text style={st.sectionTitle}>Notes</Text>
                    <Text style={st.small}>{data.notes}</Text>
                  </>
                ) : null}
              </View>
            </View>
          ) : data.notes ? (
            <View style={{ marginTop: 16 }}>
              <Text style={st.sectionTitle}>Notes</Text>
              <Text style={st.small}>{data.notes}</Text>
            </View>
          ) : null}

          {data.terms ? (
            <View style={{ marginTop: 16 }}>
              <Text style={st.sectionTitle}>Terms</Text>
              <Text style={st.small}>{data.terms}</Text>
            </View>
          ) : null}
        </View>

        <View style={st.footer} fixed />
      </Page>
    </Document>
  );
}
