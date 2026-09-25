import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/money";
import { readableTextColor } from "@/lib/color-utils";
import { DEFAULT_ACCENT_COLOR, type TemplateProps } from "@/lib/pdf/templates/types";

const SIDEBAR_WIDTH = 170;

/** Full-height colored sidebar carries the identity; the document itself stays high-contrast black-on-white. The most graphic-design-forward of the set. */
export function BoldTemplate({ data, settings }: TemplateProps) {
  const currency = settings.default_currency;
  const accent = settings.brand_color ?? DEFAULT_ACCENT_COLOR;
  const onAccent = readableTextColor(accent);
  const { customer } = data;

  const st = StyleSheet.create({
    page: { fontSize: 9, fontFamily: "Helvetica", color: "#111111" },
    sidebar: {
      position: "absolute",
      top: 0,
      left: 0,
      bottom: 0,
      width: SIDEBAR_WIDTH,
      backgroundColor: accent,
      padding: 24,
      color: onAccent,
    },
    logo: { maxWidth: SIDEBAR_WIDTH - 48, maxHeight: 44, marginBottom: 12, objectFit: "contain" },
    sidebarCompanyName: { fontSize: 13, fontFamily: "Helvetica-Bold", color: onAccent, marginBottom: 10, lineHeight: 1.3 },
    sidebarSmall: { fontSize: 7.5, color: onAccent, opacity: 0.9, lineHeight: 1.6, marginBottom: 8 },
    sidebarDocTitle: { fontSize: 15, fontFamily: "Helvetica-Bold", color: onAccent, marginTop: 24, marginBottom: 2 },
    sidebarNumber: { fontSize: 9, color: onAccent, opacity: 0.9, marginBottom: 8 },
    sidebarStatus: { fontSize: 8, fontFamily: "Helvetica-Bold", color: onAccent, textTransform: "uppercase", letterSpacing: 0.5 },
    body: { marginLeft: SIDEBAR_WIDTH, padding: 32 },
    metaRow: { flexDirection: "row", gap: 28, marginBottom: 22 },
    metaLabel: { fontSize: 7, color: "#999999", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
    metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
    sectionTitle: { fontSize: 8, color: "#111111", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.7, fontFamily: "Helvetica-Bold" },
    billToName: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
    small: { fontSize: 8, color: "#555555", lineHeight: 1.4 },
    billToBlock: { marginBottom: 22 },
    tableHeaderRow: { flexDirection: "row", backgroundColor: "#111111", paddingVertical: 6, paddingHorizontal: 8 },
    th: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", color: "#ffffff" },
    tableRow: { flexDirection: "row", borderBottom: "1px solid #ececec", paddingVertical: 6, paddingHorizontal: 8 },
    colDescription: { width: "40%" },
    colQty: { width: "10%", textAlign: "right" },
    colPrice: { width: "15%", textAlign: "right" },
    colDiscount: { width: "10%", textAlign: "right" },
    colVat: { width: "10%", textAlign: "right" },
    colTotal: { width: "15%", textAlign: "right" },
    totalsBlock: { marginTop: 14, marginLeft: "auto", width: 220 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    totalsLabel: { color: "#555555" },
    grandTotalBox: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: accent,
      color: onAccent,
      paddingVertical: 9,
      paddingHorizontal: 10,
      marginTop: 6,
    },
    grandTotalLabel: { fontFamily: "Helvetica-Bold", fontSize: 12, color: onAccent },
    balanceRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, marginTop: 6 },
    balanceLabelFinal: { fontFamily: "Helvetica-Bold", fontSize: 10 },
    twoColumn: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, gap: 20 },
    block: { width: "48%" },
    footer: {
      position: "absolute",
      bottom: 0,
      left: SIDEBAR_WIDTH,
      right: 0,
      textAlign: "center",
      fontSize: 7.5,
      color: "#999999",
      paddingVertical: 10,
      borderTop: "1px solid #ececec",
    },
  });

  return (
    <Document title={data.number}>
      <Page size="A4" style={st.page}>
        <View style={st.sidebar} fixed>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
          {settings.logo_url ? <Image style={st.logo} src={settings.logo_url} /> : null}
          <Text style={st.sidebarCompanyName}>{settings.company_name}</Text>
          {settings.address_physical ? <Text style={st.sidebarSmall}>{settings.address_physical}</Text> : null}
          {[settings.phone, settings.email].filter(Boolean).length > 0 ? (
            <Text style={st.sidebarSmall}>{[settings.phone, settings.email].filter(Boolean).join("\n")}</Text>
          ) : null}
          {settings.vat_number ? <Text style={st.sidebarSmall}>VAT No: {settings.vat_number}</Text> : null}

          <Text style={st.sidebarDocTitle}>{data.docTitle}</Text>
          <Text style={st.sidebarNumber}>{data.number}</Text>
          {data.statusLabel ? <Text style={st.sidebarStatus}>{data.statusLabel}</Text> : null}
        </View>

        <View style={st.body}>
          <View style={st.metaRow}>
            {data.metaFields
              .filter((field) => field.value !== data.number)
              .map((field) => (
                <View key={field.label}>
                  <Text style={st.metaLabel}>{field.label}</Text>
                  <Text style={st.metaValue}>{field.value}</Text>
                </View>
              ))}
          </View>

          <View style={st.billToBlock}>
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

        <Text style={st.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
