import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { pdfStyles as s, pdfAccentStyles } from "@/lib/pdf/styles";
import { formatCurrency } from "@/lib/money";
import type { CreditNoteWithItems } from "@/server/services/credit-notes";
import type { CompanySettings } from "@/lib/config/system-settings";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
};

export function CreditNotePdf({ creditNote, settings }: { creditNote: CreditNoteWithItems; settings: CompanySettings }) {
  const currency = settings.default_currency;
  const customer = creditNote.customers;
  const accent = pdfAccentStyles(settings.brand_color);

  return (
    <Document title={`${creditNote.credit_note_number}`}>
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
            <Text style={[s.docTitle, accent.docTitle]}>CREDIT NOTE</Text>
            <Text style={s.statusBadge}>{STATUS_LABELS[creditNote.status] ?? creditNote.status}</Text>
            <Text style={s.metaLabel}>Credit note number</Text>
            <Text style={s.metaValue}>{creditNote.credit_note_number}</Text>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{formatDate(creditNote.credit_note_date)}</Text>
            {creditNote.invoices ? (
              <>
                <Text style={s.metaLabel}>Relates to invoice</Text>
                <Text style={s.metaValue}>{creditNote.invoices.invoice_number}</Text>
              </>
            ) : null}
          </View>
        </View>

        <View style={s.billToBlock}>
          <Text style={s.sectionTitle}>Issued To</Text>
          <Text style={s.billToName}>{customer?.company_name}</Text>
          {customer?.contact_person ? <Text style={s.small}>{customer.contact_person}</Text> : null}
          {customer?.address_physical ? <Text style={s.small}>{customer.address_physical}</Text> : null}
          {customer?.email ? <Text style={s.small}>{customer.email}</Text> : null}
          {customer?.vat_number ? <Text style={s.small}>VAT No: {customer.vat_number}</Text> : null}
        </View>

        {creditNote.reason ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={s.sectionTitle}>Reason</Text>
            <Text style={s.small}>{creditNote.reason}</Text>
          </View>
        ) : null}

        <View style={s.table}>
          <View style={[s.tableHeaderRow, accent.tableHeaderRow]}>
            <Text style={[s.th, s.colDescription]}>Description</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colPrice]}>Unit Price</Text>
            <Text style={[s.th, s.colDiscount]}>Disc %</Text>
            <Text style={[s.th, s.colVat]}>VAT %</Text>
            <Text style={[s.th, s.colTotal]}>Total</Text>
          </View>
          {creditNote.credit_note_items.map((item) => (
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
            <Text>{formatCurrency(creditNote.subtotal, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Discount</Text>
            <Text>-{formatCurrency(creditNote.discount_total, currency)}</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>VAT</Text>
            <Text>{formatCurrency(creditNote.vat_total, currency)}</Text>
          </View>
          <View style={[s.totalsRowFinal, accent.totalsRowFinal]}>
            <Text style={[s.totalsValueFinal, accent.totalsValueFinal]}>Total credit</Text>
            <Text style={[s.totalsValueFinal, accent.totalsValueFinal]}>{formatCurrency(creditNote.total, currency)}</Text>
          </View>
        </View>

        {creditNote.notes ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionTitle}>Notes</Text>
            <Text style={s.small}>{creditNote.notes}</Text>
          </View>
        ) : null}

        {creditNote.terms ? (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionTitle}>Terms</Text>
            <Text style={s.small}>{creditNote.terms}</Text>
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
