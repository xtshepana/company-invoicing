import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { formatCurrency } from "@/lib/money";
import { DEFAULT_ACCENT_COLOR, type TemplateProps } from "@/lib/pdf/templates/types";

/** Airy and understated - no fills, thin rules only, one accent-colored line under the header. */
export function MinimalTemplate({ data, settings }: TemplateProps) {
  const currency = settings.default_currency;
  const accent = settings.brand_color ?? DEFAULT_ACCENT_COLOR;
  const { customer } = data;

  const st = StyleSheet.create({
    page: { padding: 48, fontSize: 9, fontFamily: "Helvetica", color: "#222222" },
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    logo: { maxWidth: 120, maxHeight: 44, marginBottom: 10, objectFit: "contain" },
    companyName: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 4, letterSpacing: 0.3 },
    small: { fontSize: 8, color: "#777777", lineHeight: 1.5 },
    docTitle: { fontSize: 18, fontFamily: "Helvetica", letterSpacing: 3, textAlign: "right", color: "#222222" },
    number: { fontSize: 9, textAlign: "right", color: "#777777", marginTop: 2 },
    statusBadge: { fontSize: 8, textAlign: "right", marginTop: 6, color: "#777777", textTransform: "uppercase", letterSpacing: 0.5 },
    accentRule: { height: 2, backgroundColor: accent, marginTop: 20, marginBottom: 24, width: 60 },
    metaRow: { flexDirection: "row", gap: 32, marginBottom: 28 },
    metaLabel: { fontSize: 7, color: "#999999", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
    metaValue: { fontSize: 9 },
    sectionTitle: { fontSize: 7, color: "#999999", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 },
    billToBlock: { marginBottom: 28 },
    billToName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
    tableHeaderRow: { flexDirection: "row", borderBottom: "1px solid #222222", paddingBottom: 6, marginBottom: 2 },
    tableRow: { flexDirection: "row", borderBottom: "0.5px solid #eaeaea", paddingVertical: 7 },
    th: { fontSize: 7, textTransform: "uppercase", letterSpacing: 0.5, color: "#999999" },
    colDescription: { width: "40%" },
    colQty: { width: "10%", textAlign: "right" },
    colPrice: { width: "15%", textAlign: "right" },
    colDiscount: { width: "10%", textAlign: "right" },
    colVat: { width: "10%", textAlign: "right" },
    colTotal: { width: "15%", textAlign: "right" },
    totalsBlock: { marginTop: 16, marginLeft: "auto", width: 220 },
    totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
    totalsLabel: { color: "#777777" },
    totalsRowFinal: { flexDirection: "row", justifyContent: "space-between", paddingTop: 8, marginTop: 6, borderTop: "1px solid #222222" },
    totalsValueFinal: { fontFamily: "Helvetica-Bold", fontSize: 12 },
    twoColumn: { flexDirection: "row", justifyContent: "space-between", marginTop: 32, gap: 24 },
    block: { width: "48%" },
    footer: { position: "absolute", bottom: 36, left: 48, right: 48, textAlign: "center", fontSize: 7, color: "#aaaaaa" },
  });

  return (
    <Document title={data.number}>
      <Page size="A4" style={st.page}>
        <View style={st.header}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
            {settings.logo_url ? <Image style={st.logo} src={settings.logo_url} /> : null}
            <Text style={st.companyName}>{settings.company_name}</Text>
            <Text style={st.small}>{settings.address_physical}</Text>
            <Text style={st.small}>{[settings.phone, settings.email].filter(Boolean).join("   ")}</Text>
            {settings.vat_number ? <Text style={st.small}>VAT No: {settings.vat_number}</Text> : null}
          </View>
          <View>
            <Text style={st.docTitle}>{data.docTitle}</Text>
            <Text style={st.number}>{data.number}</Text>
            {data.statusLabel ? <Text style={st.statusBadge}>{data.statusLabel}</Text> : null}
          </View>
        </View>

        <View style={st.accentRule} />

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
          <View style={{ marginTop: 20 }}>
            <Text style={st.sectionTitle}>Notes</Text>
            <Text style={st.small}>{data.notes}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={{ marginTop: 20 }}>
            <Text style={st.sectionTitle}>Terms</Text>
            <Text style={st.small}>{data.terms}</Text>
          </View>
        ) : null}

        <Text style={st.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
