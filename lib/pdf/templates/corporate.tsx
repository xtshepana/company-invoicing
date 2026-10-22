import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { showsBankingDetails } from "@/lib/pdf/banking";
import { documentTitle } from "@/lib/pdf/document-title";
import { HEX_COLOR_PATTERN, readableTextColor, shadeColor } from "@/lib/color-utils";
import { formatCurrency } from "@/lib/money";
import { LetterheadFooter } from "@/lib/pdf/letterhead-footer";
import type { DocumentData } from "@/lib/pdf/document-data";
import type { TemplateProps } from "@/lib/pdf/templates/types";

/*
 * "Corporate": a boxed, form-style layout - a coloured title bar, bordered
 * company / customer / meta panels with grey labels, a coloured items header,
 * and totals, banking and notes in the same box style. The two colours come
 * from the company's brand colours (picked from the logo - see corporateColors);
 * navy and orange are only the fallback when no brand colour is set.
 */
const NAVY = "#00008b";
const ORANGE = "#e0731e";
const LABEL_BG = "#c3c3c3";
const BORDER = "#6b6b6b";
const INK = "#111111";
const MUTED = "#555555";

const s = StyleSheet.create({
  // The bottom padding keeps content clear of the fixed letterhead footer.
  page: { paddingTop: 24, paddingHorizontal: 24, paddingBottom: 96, fontSize: 8.5, fontFamily: "Helvetica", color: INK },

  titleBar: { backgroundColor: NAVY, borderRadius: 3, paddingVertical: 7 },
  titleText: { color: "#ffffff", fontSize: 17, fontFamily: "Helvetica-Bold", textAlign: "center" },

  slimBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: NAVY, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 8 },
  slimText: { color: "#ffffff", fontSize: 9, fontFamily: "Helvetica-Bold" },
  // Sits over the right end of the slim bar: bar top = page padding (24) + padding (5), right = page padding + bar padding.
  slimPageCount: { position: "absolute", top: 29.5, right: 34, color: "#ffffff", fontSize: 9, fontFamily: "Helvetica-Bold" },

  row: { flexDirection: "row" },
  box: { border: `0.75px solid ${BORDER}`, borderRadius: 3, padding: 8 },

  // Both header rows split 50/50 with an 8pt gutter. The split is done by plain column wrappers (no padding or border), because a flex
  // item's padding and border skew the split — which is what pushed the right-hand column of the two rows out of line.
  colLeft: { flexGrow: 1, flexBasis: 0, marginRight: 8 },
  colRight: { flexGrow: 1, flexBasis: 0 },
  companyBox: { flexGrow: 1, justifyContent: "space-between" },
  logo: { maxWidth: 150, maxHeight: 54, objectFit: "contain", marginBottom: 6 },
  companyName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  line: { fontSize: 8, lineHeight: 1.45 },
  bold: { fontFamily: "Helvetica-Bold" },

  metaRow: { flexDirection: "row", marginBottom: 4 },
  metaLabel: { backgroundColor: LABEL_BG, borderRadius: 3, justifyContent: "center", paddingHorizontal: 7, paddingVertical: 6, width: 88 },
  metaLabelText: { fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  metaValue: { flexGrow: 1, flexBasis: 0, border: `0.75px solid ${BORDER}`, borderRadius: 3, justifyContent: "center", paddingHorizontal: 7, paddingVertical: 5, marginLeft: 4 },
  metaValueText: { fontSize: 8.5, textAlign: "center" },

  partyBox: { flexGrow: 1, minHeight: 78 },
  partyTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 3 },

  stripCell: { flexGrow: 1, flexBasis: 0 },
  stripLabel: { backgroundColor: LABEL_BG, borderRadius: 3, paddingVertical: 5, alignItems: "center" },
  stripValue: { border: `0.75px solid ${BORDER}`, borderRadius: 3, paddingVertical: 5, marginTop: 3, alignItems: "center", minHeight: 20 },

  tableHead: { flexDirection: "row", backgroundColor: ORANGE, borderTopLeftRadius: 3, borderTopRightRadius: 3, paddingVertical: 6, paddingHorizontal: 6 },
  th: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8.5 },
  // flexGrow lets the body stretch to fill what is left of the first page, like a printed form.
  tableBody: { flexGrow: 1, minHeight: 120, borderLeft: `0.75px solid ${BORDER}`, borderRight: `0.75px solid ${BORDER}`, borderBottom: `0.75px solid ${BORDER}`, paddingHorizontal: 6, paddingTop: 4, paddingBottom: 4 },
  tableRow: { flexDirection: "row", paddingVertical: 2.5 },
  colDescription: { width: "46%" },
  colQty: { width: "8%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colDiscount: { width: "9%", textAlign: "right" },
  colVat: { width: "8%", textAlign: "right" },
  colTotal: { width: "14%", textAlign: "right" },

  totalsLabel: { backgroundColor: LABEL_BG, borderRadius: 3, justifyContent: "center", paddingHorizontal: 7, paddingVertical: 5, width: 96 },
  totalsValue: { flexGrow: 1, flexBasis: 0, border: `0.75px solid ${BORDER}`, borderRadius: 3, justifyContent: "center", paddingHorizontal: 7, paddingVertical: 5, marginLeft: 4 },
  totalsText: { textAlign: "right", fontSize: 9 },

  // Banking details: a dark band (heading + payment reference) over a lighter box, like a printed remittance block.
  bankBand: { backgroundColor: BORDER, borderTopLeftRadius: 3, borderTopRightRadius: 3, paddingVertical: 5, paddingHorizontal: 8 },
  bankBandText: { color: "#ffffff", fontFamily: "Helvetica-Bold", fontSize: 8.5, lineHeight: 1.4 },
  bankBox: { backgroundColor: "#ececec", borderBottomLeftRadius: 3, borderBottomRightRadius: 3, borderWidth: 0.75, borderTopWidth: 0, borderStyle: "solid", borderColor: BORDER, paddingVertical: 6, paddingHorizontal: 8 },
  bankName: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },

  sectionLabel: { backgroundColor: LABEL_BG, borderRadius: 3, paddingHorizontal: 7, paddingVertical: 4, marginBottom: 4, alignSelf: "flex-start" },
});

/** The title shown in the bar - the shared rule (see lib/pdf/document-title.ts). Kept as a named export for this template's tests. */
export function corporateTitle(docKind: DocumentData["docKind"], vatRegistered: boolean): string {
  return documentTitle(docKind, vatRegistered);
}

export interface CorporateColors {
  /** Title bar, continuation bar and the Total row. */
  primary: string;
  /** Items header and the Balance Due row. */
  secondary: string;
  onPrimary: string;
  onSecondary: string;
}

const validHex = (value: string | null | undefined): string | null => (value && HEX_COLOR_PATTERN.test(value) ? value : null);

/**
 * The template's two colours. Primary is the company's brand colour and secondary its second logo colour; with only a
 * primary the secondary is a darker shade of it (so the layout stays one family), and with neither it is the original
 * navy and orange. Text on each colour is black or white, whichever reads better.
 */
export function corporateColors(settings: TemplateProps["settings"]): CorporateColors {
  const brand = validHex(settings.brand_color);
  const primary = brand ?? NAVY;
  const secondary = validHex(settings.brand_color_secondary) ?? (brand ? shadeColor(brand, 0.35) : ORANGE);
  return { primary, secondary, onPrimary: readableTextColor(primary), onSecondary: readableTextColor(secondary) };
}

function LabelValue({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.metaRow, last ? { marginBottom: 0 } : {}]}>
      <View style={s.metaLabel}>
        <Text style={s.metaLabelText}>{label}</Text>
      </View>
      <View style={s.metaValue}>
        <Text style={s.metaValueText}>{value}</Text>
      </View>
    </View>
  );
}

/** "Page x of y" in the same label / value shape as every other row of the panel. */
function PageRow() {
  return (
    <View style={[s.metaRow, { marginBottom: 0 }]}>
      <View style={s.metaLabel}>
        <Text style={s.metaLabelText}>Page</Text>
      </View>
      <View style={s.metaValue}>
        <Text style={s.metaValueText} render={({ pageNumber, totalPages }) => `${pageNumber} of ${totalPages}`} />
      </View>
    </View>
  );
}

function StripCell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.stripCell, last ? {} : { marginRight: 8 }]}>
      <View style={s.stripLabel}>
        <Text style={s.metaLabelText}>{label}</Text>
      </View>
      <View style={s.stripValue}>
        <Text style={{ fontSize: 8.5 }}>{value}</Text>
      </View>
    </View>
  );
}

function TotalsRow({ label, value, emphasis, colors }: { label: string; value: string; emphasis?: "total" | "due"; colors: CorporateColors }) {
  const filled = emphasis === "total" ? colors.primary : emphasis === "due" ? colors.secondary : null;
  const onFilled = emphasis === "total" ? colors.onPrimary : colors.onSecondary;
  return (
    <View style={[s.row, { marginBottom: 4 }]}>
      <View style={[s.totalsLabel, filled ? { backgroundColor: filled } : {}]}>
        <Text style={[s.metaLabelText, filled ? { color: onFilled } : {}]}>{label}</Text>
      </View>
      <View style={[s.totalsValue, filled ? { borderColor: filled } : {}]}>
        <Text style={[s.totalsText, emphasis ? { fontFamily: "Helvetica-Bold" } : {}]}>{value}</Text>
      </View>
    </View>
  );
}

export function CorporateTemplate({ data, settings }: TemplateProps) {
  const currency = settings.default_currency;
  const title = corporateTitle(data.docKind, settings.vat_registered);
  const colors = corporateColors(settings);
  const { customer } = data;

  // The first two meta fields are always the document number and its date (see document-data.ts);
  // Reference gets its own cell in the strip, and anything else (due date, expiry, reason) is listed after.
  const [numberField, dateField, ...restFields] = data.metaFields;
  const reference = restFields.find((field) => field.label === "Reference")?.value ?? "";
  const extraFields = restFields.filter((field) => field.label !== "Reference");

  const billingAddress = customer.postalAddress || customer.address;

  return (
    <Document title={data.number}>
      <Page size="A4" style={s.page}>
        {/* Continuation pages get a slim header with the page count; the full header below is only on page 1. */}
        <View
          fixed
          render={({ pageNumber }) =>
            pageNumber > 1 ? (
              <View style={[s.slimBar, { backgroundColor: colors.primary }]}>
                <Text style={[s.slimText, { color: colors.onPrimary }]}>
                  {title} {data.number}
                </Text>
              </View>
            ) : (
              <View />
            )
          }
        />
        {/*
          Only text elements are told the total page count, and a page-number element nested inside the
          conditional view above is not resolved, so the count is its own fixed element laid over the right
          end of the slim bar (empty on page 1, where the full header shows "Page 1 of N" instead).
        */}
        <Text
          fixed
          style={[s.slimPageCount, { color: colors.onPrimary }]}
          render={({ pageNumber, totalPages }) => (pageNumber > 1 ? `Page ${pageNumber} of ${totalPages}` : "")}
        />

        <View style={[s.titleBar, { backgroundColor: colors.primary }]}>
          <Text style={[s.titleText, { color: colors.onPrimary }]}>{title}</Text>
        </View>

        <View style={[s.row, { marginTop: 8 }]}>
          <View style={s.colLeft}>
          <View style={[s.box, s.companyBox]}>
            <View>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img; no alt prop exists on this component */}
              {settings.logo_url ? <Image style={s.logo} src={settings.logo_url} /> : null}
              {settings.show_company_name ? <Text style={s.companyName}>{settings.company_name}</Text> : null}
              {settings.trading_name ? <Text style={s.line}>Trading as {settings.trading_name}</Text> : null}
              {settings.address_physical ? <Text style={s.line}>{settings.address_physical}</Text> : null}
            </View>
            <View style={[s.row, { marginTop: 8, justifyContent: "space-between" }]}>
              <View>
                {settings.email ? (
                  <Text style={s.line}>
                    <Text style={s.bold}>Email: </Text>
                    {settings.email}
                  </Text>
                ) : null}
                {settings.phone ? (
                  <Text style={s.line}>
                    <Text style={s.bold}>Tel: </Text>
                    {settings.phone}
                  </Text>
                ) : null}
              </View>
              <View>
                {settings.registration_number ? (
                  <Text style={s.line}>
                    <Text style={s.bold}>Reg: </Text>
                    {settings.registration_number}
                  </Text>
                ) : null}
                {settings.vat_number ? (
                  <Text style={s.line}>
                    <Text style={s.bold}>VAT: </Text>
                    {settings.vat_number}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          </View>

          <View style={s.colRight}>
            <LabelValue label="Document No." value={numberField?.value ?? data.number} />
            <LabelValue label="Date" value={dateField?.value ?? ""} />
            {extraFields.map((field) => (
              <LabelValue key={field.label} label={field.label.replace(/ date$/i, "").replace(/^Due$/, "Due By")} value={field.value} />
            ))}
            {data.statusLabel ? <LabelValue label="Status" value={data.statusLabel} /> : null}
            <PageRow />
          </View>
        </View>

        <View style={[s.row, { marginTop: 8 }]}>
          <View style={s.colLeft}>
            <View style={[s.box, s.partyBox]}>
              <Text style={s.partyTitle}>{customer.name}</Text>
              {billingAddress ? <Text style={s.line}>{billingAddress}</Text> : null}
              {customer.contactPerson ? <Text style={s.line}>{customer.contactPerson}</Text> : null}
              {customer.email ? <Text style={s.line}>{customer.email}</Text> : null}
            </View>
          </View>
          <View style={s.colRight}>
            <View style={[s.box, s.partyBox]}>
              <Text style={s.partyTitle}>Delivery Address:</Text>
              {customer.address ? <Text style={s.line}>{customer.address}</Text> : null}
            </View>
          </View>
        </View>

        <View style={[s.row, { marginTop: 8, marginBottom: 8 }]}>
          <StripCell label="Account" value={customer.accountNo} />
          <StripCell label="Reference / PO No." value={reference} />
          <StripCell label="Customer VAT No." value={customer.vatNumber} last />
        </View>

        <View style={{ flexGrow: 1 }}>
          <View style={[s.tableHead, { backgroundColor: colors.secondary }]} fixed>
            <Text style={[s.th, { color: colors.onSecondary }, s.colDescription]}>Description</Text>
            <Text style={[s.th, { color: colors.onSecondary }, s.colQty]}>Qty</Text>
            <Text style={[s.th, { color: colors.onSecondary }, s.colPrice]}>Unit Price</Text>
            <Text style={[s.th, { color: colors.onSecondary }, s.colDiscount]}>Disc %</Text>
            <Text style={[s.th, { color: colors.onSecondary }, s.colVat]}>VAT %</Text>
            <Text style={[s.th, { color: colors.onSecondary }, s.colTotal]}>Line Total</Text>
          </View>
          <View style={s.tableBody}>
            {data.lineItems.map((item, index) => (
              <View style={s.tableRow} key={index} wrap={false}>
                <Text style={s.colDescription}>{item.description}</Text>
                <Text style={s.colQty}>{item.quantity}</Text>
                <Text style={s.colPrice}>{formatCurrency(item.unitPrice, currency)}</Text>
                <Text style={s.colDiscount}>{item.discountPercent ? `${item.discountPercent}%` : ""}</Text>
                <Text style={s.colVat}>{item.vatRate}%</Text>
                <Text style={s.colTotal}>{formatCurrency(item.lineTotal, currency)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.row, { marginTop: 10 }]} wrap={false}>
          <View style={{ flexGrow: 1, flexBasis: 0, marginRight: 12 }}>
            {showsBankingDetails(data.docKind) && settings.bank_name ? (
              <View style={{ marginBottom: 8 }} wrap={false}>
                <View style={s.bankBand}>
                  <Text style={s.bankBandText}>Banking Details</Text>
                  {customer.accountNo ? <Text style={s.bankBandText}>Payment Reference: {customer.accountNo}</Text> : null}
                </View>
                <View style={s.bankBox}>
                  <Text style={s.bankName}>{settings.bank_name}</Text>
                  {settings.bank_account_name ? <Text style={s.line}>{settings.bank_account_name}</Text> : null}
                  {settings.bank_account_type ? <Text style={s.line}>Account Type: {settings.bank_account_type}</Text> : null}
                  {settings.bank_branch_code ? <Text style={s.line}>Branch Code: {settings.bank_branch_code}</Text> : null}
                  {settings.bank_account_number ? <Text style={s.line}>Acc No: {settings.bank_account_number}</Text> : null}
                </View>
              </View>
            ) : null}
            {data.notes ? (
              <View style={{ marginBottom: 8 }}>
                <View style={s.sectionLabel}>
                  <Text style={s.metaLabelText}>Notes</Text>
                </View>
                <Text style={[s.line, { color: MUTED }]}>{data.notes}</Text>
              </View>
            ) : null}
            {data.terms ? (
              <View>
                <View style={s.sectionLabel}>
                  <Text style={s.metaLabelText}>Terms</Text>
                </View>
                <Text style={[s.line, { color: MUTED }]}>{data.terms}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ width: 232 }}>
            <TotalsRow label="Subtotal" value={formatCurrency(data.totals.subtotal, currency)} colors={colors} />
            {data.totals.discount ? <TotalsRow label="Discount" value={`-${formatCurrency(data.totals.discount, currency)}`} colors={colors} /> : null}
            <TotalsRow label="VAT" value={formatCurrency(data.totals.vat, currency)} colors={colors} />
            <TotalsRow label="Total" value={formatCurrency(data.totals.total, currency)} emphasis="total" colors={colors} />
            {data.docKind === "invoice" ? (
              <>
                <TotalsRow label="Amount Paid" value={formatCurrency(data.totals.amountPaid ?? 0, currency)} colors={colors} />
                <TotalsRow label="Balance Due" value={formatCurrency(data.totals.balanceDue ?? 0, currency)} emphasis="due" colors={colors} />
              </>
            ) : null}
          </View>
        </View>

        <LetterheadFooter settings={settings} position={{ bottom: 24, left: 24, right: 24 }} />
      </Page>
    </Document>
  );
}
