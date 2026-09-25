import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/money";
import type { TemplateProps } from "@/lib/pdf/templates/types";

/** Serif typography, a centered masthead, and a deliberately muted, timeless palette - no brand color, by design. */
export function ElegantTemplate({ data, settings }: TemplateProps) {
  const currency = settings.default_currency;
  const { customer } = data;

  const st = StyleSheet.create({
    page: { padding: 48, fontSize: 9, fontFamily: "Times-Roman", color: "#222222" },
    masthead: { alignItems: "center", marginBottom: 16 },
    logo: { maxWidth: 120, maxHeight: 44, marginBottom: 8, objectFit: "contain" },
    companyName: { fontSize: 16, fontFamily: "Times-Bold", letterSpacing: 1, marginBottom: 4, textAlign: "center" },
    small: { fontSize: 8, color: "#666666", lineHeight: 1.5, textAlign: "center" },
    doubleRule: { marginTop: 16, marginBottom: 16 },
    ruleThick: { height: 1.2, backgroundColor: "#222222" },
    ruleThin: { height: 0.6, backgroundColor: "#222222", marginTop: 2 },
    docTitleBlock: { alignItems: "center", marginBottom: 20 },
    docTitle: { fontSize: 14, fontFamily: "Times-Bold", letterSpacing: 4, textAlign: "center" },
    number: { fontSize: 9, fontFamily: "Times-Italic", color: "#666666", marginTop: 4, textAlign: "center" },
    statusBadge: { fontSize: 8, fontFamily: "Times-Italic", color: "#666666", marginTop: 4, textAlign: "center" },
    infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
    sectionTitle: { fontSize: 8, fontFamily: "Times-Italic", color: "#666666", marginBottom: 5 },
    billToName: { fontSize: 11, fontFamily: "Times-Bold", marginBottom: 2 },
    metaField: { marginBottom: 4, alignItems: "flex-end" },
    metaLabel: { fontSize: 8, fontFamily: "Times-Italic", color: "#666666" },
    metaValue: { fontSize: 9, fontFamily: "Times-Bold" },
    tableHeaderRow: { flexDirection: "row", borderBottom: "1px solid #222222", paddingBottom: 5, marginBottom: 4 },
    tableRow: { flexDirection: "row", borderBottom: "0.5px solid #dddddd", paddingVertical: 6 },
    th: { fontSize: 8, fontFamily: "Times-Bold", letterSpacing: 0.5 },
    colDescription: { width: "40%" },
    colQty: { width: "10%", textAlign: "right" },
    colPrice: { width: "15%", textAlign: "right" },
    colDiscount: { width: "10%", textAlign: "right" },
    colVat: { width: "10%", textAlign: "right" },
    colTotal: { width: "15%", textAlign: "right" },
    totalsBlock: { marginTop: 14, marginLeft: "auto", width: 220 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    totalsLabel: { color: "#666666" },
    totalsRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 7, marginTop: 5, borderTop: "1px solid #222222" },
    totalsValueFinal: { fontFamily: "Times-Bold", fontSize: 11 },
    twoColumn: { flexDirection: "row", justifyContent: "space-between", marginTop: 26, gap: 20 },
    block: { width: "48%" },
    footer: {
      position: "absolute",
      bottom: 32,
      left: 48,
      right: 48,
      textAlign: "center",
      fontSize: 8,
      fontFamily: "Times-Italic",
      color: "#999999",
      borderTop: "0.6px solid #dddddd",
      paddingTop: 8,
    },
  });

  return (
    <Document title={data.number}>
      <Page size="A4" style={st.page}>
        <View style={st.masthead}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
          {settings.logo_url ? <Image style={st.logo} src={settings.logo_url} /> : null}
          <Text style={st.companyName}>{settings.company_name}</Text>
          {settings.trading_name ? <Text style={st.small}>Trading as {settings.trading_name}</Text> : null}
          <Text style={st.small}>{settings.address_physical}</Text>
          <Text style={st.small}>{[settings.phone, settings.email].filter(Boolean).join("  ·  ")}</Text>
          {settings.vat_number ? <Text style={st.small}>VAT No: {settings.vat_number}</Text> : null}
        </View>

        <View style={st.doubleRule}>
          <View style={st.ruleThick} />
          <View style={st.ruleThin} />
        </View>

        <View style={st.docTitleBlock}>
          <Text style={st.docTitle}>{data.docTitle}</Text>
          <Text style={st.number}>{data.number}</Text>
          {data.statusLabel ? <Text style={st.statusBadge}>{data.statusLabel}</Text> : null}
        </View>

        <View style={st.infoRow}>
          <View>
            <Text style={st.sectionTitle}>{data.billToLabel}</Text>
            <Text style={st.billToName}>{customer.name}</Text>
            {customer.accountNo ? <Text style={[st.small, { textAlign: "left" }]}>Account No: {customer.accountNo}</Text> : null}
            {customer.contactPerson ? <Text style={[st.small, { textAlign: "left" }]}>{customer.contactPerson}</Text> : null}
            {customer.address ? <Text style={[st.small, { textAlign: "left" }]}>{customer.address}</Text> : null}
            {customer.email ? <Text style={[st.small, { textAlign: "left" }]}>{customer.email}</Text> : null}
            {customer.vatNumber ? <Text style={[st.small, { textAlign: "left" }]}>VAT No: {customer.vatNumber}</Text> : null}
          </View>
          <View>
            {data.metaFields
              .filter((field) => field.value !== data.number)
              .map((field) => (
                <View key={field.label} style={st.metaField}>
                  <Text style={st.metaLabel}>{field.label}</Text>
                  <Text style={st.metaValue}>{field.value}</Text>
                </View>
              ))}
          </View>
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
          <View style={st.totalsRowFinal}>
            <Text style={st.totalsValueFinal}>Total</Text>
            <Text style={st.totalsValueFinal}>{formatCurrency(data.totals.total, currency)}</Text>
          </View>
          {data.docKind === "invoice" ? (
            <>
              <View style={st.totalsRow}>
                <Text style={st.totalsLabel}>Amount paid</Text>
                <Text>{formatCurrency(data.totals.amountPaid ?? 0, currency)}</Text>
              </View>
              <View style={st.totalsRowFinal}>
                <Text style={st.totalsValueFinal}>Balance due</Text>
                <Text style={st.totalsValueFinal}>{formatCurrency(data.totals.balanceDue ?? 0, currency)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {data.docKind === "invoice" ? (
          <View style={st.twoColumn}>
            <View style={st.block}>
              <Text style={st.sectionTitle}>Banking Details</Text>
              <Text style={[st.small, { textAlign: "left" }]}>{settings.bank_name}</Text>
              <Text style={[st.small, { textAlign: "left" }]}>{settings.bank_account_name}</Text>
              <Text style={[st.small, { textAlign: "left" }]}>Acc No: {settings.bank_account_number}</Text>
              <Text style={[st.small, { textAlign: "left" }]}>Branch Code: {settings.bank_branch_code}</Text>
              <Text style={[st.small, { textAlign: "left" }]}>Account Type: {settings.bank_account_type}</Text>
            </View>
            <View style={st.block}>
              {data.notes ? (
                <>
                  <Text style={st.sectionTitle}>Notes</Text>
                  <Text style={[st.small, { textAlign: "left" }]}>{data.notes}</Text>
                </>
              ) : null}
            </View>
          </View>
        ) : data.notes ? (
          <View style={{ marginTop: 18 }}>
            <Text style={st.sectionTitle}>Notes</Text>
            <Text style={[st.small, { textAlign: "left" }]}>{data.notes}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={{ marginTop: 18 }}>
            <Text style={st.sectionTitle}>Terms</Text>
            <Text style={[st.small, { textAlign: "left" }]}>{data.terms}</Text>
          </View>
        ) : null}

        <Text style={st.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
