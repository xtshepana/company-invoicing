import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";
import { pdfStyles as s } from "@/lib/pdf/styles";
import { formatCurrency } from "@/lib/money";
import type { CustomerStatement } from "@/server/services/statements";
import type { CompanySettings } from "@/lib/config/system-settings";

const statementStyles = StyleSheet.create({
  colDate: { width: "14%" },
  colRef: { width: "16%" },
  colDesc: { width: "34%" },
  colAmount: { width: "12%", textAlign: "right" },
});

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function StatementPdf({ statement, settings }: { statement: CustomerStatement; settings: CompanySettings }) {
  const currency = settings.default_currency;

  return (
    <Document title={`Statement - ${statement.customer.company_name}`}>
      <Page size="A4" style={s.page}>
        <View style={s.headerRow}>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
            {settings.logo_url ? <Image style={s.logo} src={settings.logo_url} /> : null}
            <Text style={s.companyName}>{settings.company_name}</Text>
            <Text style={s.small}>{settings.address_physical}</Text>
            <Text style={s.small}>{[settings.phone, settings.email].filter(Boolean).join("  ·  ")}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>STATEMENT</Text>
            <Text style={s.metaLabel}>As at</Text>
            <Text style={s.metaValue}>{formatDate(new Date().toISOString())}</Text>
          </View>
        </View>

        <View style={s.billToBlock}>
          <Text style={s.sectionTitle}>Customer</Text>
          <Text style={s.billToName}>{statement.customer.company_name}</Text>
          {statement.customer.address_physical ? <Text style={s.small}>{statement.customer.address_physical}</Text> : null}
        </View>

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, statementStyles.colDate]}>Date</Text>
            <Text style={[s.th, statementStyles.colRef]}>Reference</Text>
            <Text style={[s.th, statementStyles.colDesc]}>Description</Text>
            <Text style={[s.th, statementStyles.colAmount]}>Debit</Text>
            <Text style={[s.th, statementStyles.colAmount]}>Credit</Text>
            <Text style={[s.th, statementStyles.colAmount]}>Balance</Text>
          </View>
          {statement.lines.map((line, index) => (
            <View style={s.tableRow} key={index}>
              <Text style={statementStyles.colDate}>{formatDate(line.date)}</Text>
              <Text style={statementStyles.colRef}>{line.reference || "—"}</Text>
              <Text style={statementStyles.colDesc}>{line.description}</Text>
              <Text style={statementStyles.colAmount}>{line.debit > 0 ? formatCurrency(line.debit, currency) : ""}</Text>
              <Text style={statementStyles.colAmount}>{line.credit > 0 ? formatCurrency(line.credit, currency) : ""}</Text>
              <Text style={statementStyles.colAmount}>{formatCurrency(line.balance, currency)}</Text>
            </View>
          ))}
        </View>

        <View style={s.totalsBlock}>
          <View style={s.totalsRowFinal}>
            <Text style={s.totalsValueFinal}>Closing balance</Text>
            <Text style={s.totalsValueFinal}>{formatCurrency(statement.closingBalance, currency)}</Text>
          </View>
        </View>

        <Text style={s.footer} fixed>
          {settings.default_invoice_footer || settings.company_name}
        </Text>
      </Page>
    </Document>
  );
}
