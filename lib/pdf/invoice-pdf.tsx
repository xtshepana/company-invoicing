import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { pdfStyles as s } from "@/lib/pdf/styles";
import { formatCurrency } from "@/lib/money";
import type { InvoiceWithItems } from "@/server/services/invoices";
import type { CompanySettings } from "@/lib/config/system-settings";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};

export function InvoicePdf({ invoice, settings }: { invoice: InvoiceWithItems; settings: CompanySettings }) {
  const currency = settings.default_currency;
  const customer = invoice.customers;

  return (
    <Document title={`${invoice.invoice_number}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
            {settings.logo_url ? <Image style={s.logo} src={settings.logo_url} /> : null}
            <Text style={s.companyName}>{settings.company_name}</Text>
            {settings.trading_name ? <Text style={s.small}>Trading as {settings.trading_name}</Text> : null}
            <Text style={s.small}>{settings.address_physical}</Text>
            <Text style={s.small}>
              {[settings.phone, settings.email].filter(Boolean).join("  ·  ")}
            </Text>
            {settings.vat_number ? <Text style={s.small}>VAT No: {settings.vat_number}</Text> : null}
            {settings.registration_number ? <Text style={s.small}>Reg No: {settings.registration_number}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>INVOICE</Text>
            <Text style={s.statusBadge}>{STATUS_LABELS[invoice.status] ?? invoice.status}</Text>
            <Text style={s.metaLabel}>Invoice number</Text>
            <Text style={s.metaValue}>{invoice.invoice_number}</Text>
            <Text style={s.metaLabel}>Invoice date</Text>
            <Text style={s.metaValue}>{formatDate(invoice.invoice_date)}</Text>
            <Text style={s.metaLabel}>Due date</Text>
            <Text style={s.metaValue}>{formatDate(invoice.due_date)}</Text>
            {invoice.reference ? (
              <>
                <Text style={s.metaLabel}>Reference</Text>
                <Text style={s.metaValue}>{invoice.reference}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={s.billToBlock}>
          <Text style={s.sectionTitle}>Bill To</Text>
          <Text style={s.billToName}>{customer?.company_name}</Text>
          {customer?.contact_person ? <Text style={s.small}>{customer.contact_person}</Text> : null}
          {customer?.address_physical ? <Text style={s.small}>{customer.address_physical}</Text> : null}
          {customer?.email ? <Text style={s.small}>{customer.email}</Text> : null}
          {customer?.vat_number ? <Text style={s.small}>VAT No: {customer.vat_number}</Text> : null}
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
          {invoice.invoice_items.map((item) => (
            <View style={s.tableRow} key={item.id}>
              <Text style={s.colDescription}>{item.description}</Text>
              <Text style={s.colQty}>{item.quantity}</Text>
              <Text style={s.colPrice}>{formatCurrency(item.unit_price, currency)}</Text>
              <Text style={s.colDiscount}>{item.discount_percent}%</Text>
              <Text style={s.colVat}>{item.vat_rate}%</Text>
              <Text style={s.colTotal}>{formatCurrency(item.line_total, currency)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsBlock}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text>{formatCurrency(invoice.subtotal, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Discount</Text>
            <Text>-{formatCurrency(invoice.discount_total, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>VAT</Text>
            <Text>{formatCurrency(invoice.vat_total, currency)}</Text>
          </View>
          <View style={s.totalsRowFinal}>
            <Text style={s.totalsValueFinal}>Total</Text>
            <Text style={s.totalsValueFinal}>{formatCurrency(invoice.total, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Amount paid</Text>
            <Text>{formatCurrency(invoice.amount_paid, currency)}</Text>
          </View>
          <View style={s.totalsRowFinal}>
            <Text style={s.totalsValueFinal}>Balance due</Text>
            <Text style={s.totalsValueFinal}>{formatCurrency(invoice.balance_due ?? 0, currency)}</Text>
          </View>
        </View>

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
            {invoice.notes ? (
              <>
                <Text style={s.sectionTitle}>Notes</Text>
                <Text style={s.small}>{invoice.notes}</Text>
              </>
            ) : null}
          </View>
        </View>

        {invoice.terms ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionTitle}>Terms</Text>
            <Text style={s.small}>{invoice.terms}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
