import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { pdfStyles as s } from "@/lib/pdf/styles";
import { formatCurrency } from "@/lib/money";
import type { TemplateProps } from "@/lib/pdf/templates/types";

/** The original design - clean, left company block / right document meta, bordered table, totals bottom-right. */
export function ClassicTemplate({ data, settings }: TemplateProps) {
  const currency = settings.default_currency;
  const { customer } = data;

  return (
    <Document title={data.number}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
            {settings.logo_url ? <Image style={s.logo} src={settings.logo_url} /> : null}
            <Text style={s.companyName}>{settings.company_name}</Text>
            {settings.trading_name ? <Text style={s.small}>Trading as {settings.trading_name}</Text> : null}
            <Text style={s.small}>{settings.address_physical}</Text>
            <Text style={s.small}>{[settings.phone, settings.email].filter(Boolean).join("  ·  ")}</Text>
            {settings.vat_number ? <Text style={s.small}>VAT No: {settings.vat_number}</Text> : null}
            {settings.registration_number ? <Text style={s.small}>Reg No: {settings.registration_number}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>{data.docTitle}</Text>
            {data.statusLabel ? <Text style={s.statusBadge}>{data.statusLabel}</Text> : null}
            {data.metaFields.map((field) => (
              <View key={field.label}>
                <Text style={s.metaLabel}>{field.label}</Text>
                <Text style={s.metaValue}>{field.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.billToBlock}>
          <Text style={s.sectionTitle}>{data.billToLabel}</Text>
          <Text style={s.billToName}>{customer.name}</Text>
          {customer.accountNo ? <Text style={s.small}>Account No: {customer.accountNo}</Text> : null}
          {customer.contactPerson ? <Text style={s.small}>{customer.contactPerson}</Text> : null}
          {customer.address ? <Text style={s.small}>{customer.address}</Text> : null}
          {customer.email ? <Text style={s.small}>{customer.email}</Text> : null}
          {customer.vatNumber ? <Text style={s.small}>VAT No: {customer.vatNumber}</Text> : null}
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, s.colDescription]}>Description</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colPrice]}>Unit Price</Text>
            <Text style={[s.th, s.colDiscount]}>Disc %</Text>
            <Text style={[s.th, s.colVat]}>VAT %</Text>
            <Text style={[s.th, s.colTotal]}>Total</Text>
          </View>
          {data.lineItems.map((item, index) => (
            <View style={s.tableRow} key={index}>
              <Text style={s.colDescription}>{item.description}</Text>
              <Text style={s.colQty}>{item.quantity}</Text>
              <Text style={s.colPrice}>{formatCurrency(item.unitPrice, currency)}</Text>
              <Text style={s.colDiscount}>{item.discountPercent}%</Text>
              <Text style={s.colVat}>{item.vatRate}%</Text>
              <Text style={s.colTotal}>{formatCurrency(item.lineTotal, currency)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsBlock}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text>{formatCurrency(data.totals.subtotal, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Discount</Text>
            <Text>-{formatCurrency(data.totals.discount, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>VAT</Text>
            <Text>{formatCurrency(data.totals.vat, currency)}</Text>
          </View>
          <View style={s.totalsRowFinal}>
            <Text style={s.totalsValueFinal}>Total</Text>
            <Text style={s.totalsValueFinal}>{formatCurrency(data.totals.total, currency)}</Text>
          </View>
          {data.docKind === "invoice" ? (
            <>
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>Amount paid</Text>
                <Text>{formatCurrency(data.totals.amountPaid ?? 0, currency)}</Text>
              </View>
              <View style={s.totalsRowFinal}>
                <Text style={s.totalsValueFinal}>Balance due</Text>
                <Text style={s.totalsValueFinal}>{formatCurrency(data.totals.balanceDue ?? 0, currency)}</Text>
              </View>
            </>
          ) : null}
        </View>

        {data.docKind === "invoice" ? (
          <View style={s.twoColumn}>
            <View style={s.block}>
              <Text style={s.sectionTitle}>Banking Details</Text>
              <Text style={s.small}>{settings.bank_name}</Text>
              <Text style={s.small}>{settings.bank_account_name}</Text>
              <Text style={s.small}>Acc No: {settings.bank_account_number}</Text>
              <Text style={s.small}>Branch Code: {settings.bank_branch_code}</Text>
              <Text style={s.small}>Account Type: {settings.bank_account_type}</Text>
            </View>
            <View style={s.block}>
              {data.notes ? (
                <>
                  <Text style={s.sectionTitle}>Notes</Text>
                  <Text style={s.small}>{data.notes}</Text>
                </>
              ) : null}
            </View>
          </View>
        ) : data.notes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.small}>{data.notes}</Text>
          </View>
        ) : null}

        {data.terms ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionTitle}>Terms</Text>
            <Text style={s.small}>{data.terms}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
