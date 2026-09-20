"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseSpreadsheetFile } from "@/lib/bank-import/parse-file";
import { normalizeRows } from "@/lib/bank-import/normalize-rows";
import { COLUMN_ROLE_LABELS, DATE_FORMATS, type ColumnMapping, type ColumnRole, type ParsedSpreadsheet } from "@/lib/bank-import/types";
import { importBankTransactionsAction } from "@/server/actions/bank-transaction-actions";
import { formatCurrency } from "@/lib/money";

const ROLE_OPTIONS = Object.entries(COLUMN_ROLE_LABELS) as [ColumnRole, string][];

function guessRole(header: string): ColumnRole {
  const h = header.toLowerCase();
  if (h.includes("date")) return "date";
  if (h.includes("balance")) return "balance";
  if (h.includes("debit") || h.includes("withdrawal") || h.includes("payment out")) return "debit";
  if (h.includes("credit") || h.includes("deposit") || h.includes("payment in")) return "credit";
  if (h.includes("amount") || h.includes("value")) return "amount";
  if (h.includes("ref")) return "reference";
  if (h.includes("desc") || h.includes("narrative") || h.includes("detail")) return "description";
  return "ignore";
}

type Step = "upload" | "map" | "done";

export function ImportWizard({ currency }: { currency: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedSpreadsheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [dateFormat, setDateFormat] = useState<string>(DATE_FORMATS[0].value);
  const [invertAmount, setInvertAmount] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; duplicateCount: number } | null>(null);

  const normalized = useMemo(() => {
    if (!parsed) return { rows: [], errors: [] };
    return normalizeRows(parsed, mapping, dateFormat, invertAmount);
  }, [parsed, mapping, dateFormat, invertAmount]);

  const hasAmountMapping = useMemo(() => {
    const roles = new Set(Object.values(mapping));
    return roles.has("amount") || roles.has("debit") || roles.has("credit");
  }, [mapping]);
  const hasRequiredMapping = useMemo(() => {
    const roles = new Set(Object.values(mapping));
    return roles.has("date") && roles.has("description") && hasAmountMapping;
  }, [mapping, hasAmountMapping]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setFilename(file.name);
    try {
      const data = await parseSpreadsheetFile(file);
      if (data.headers.length === 0) {
        toast.error("Could not read any rows from this file.");
        return;
      }
      setParsed(data);
      const guessed: ColumnMapping = {};
      data.headers.forEach((header, index) => {
        guessed[index] = guessRole(header);
      });
      setMapping(guessed);
      setStep("map");
    } catch {
      toast.error("Could not read this file. Make sure it's a valid CSV or Excel export.");
    } finally {
      setParsing(false);
    }
  }

  function handleRoleChange(columnIndex: number, role: ColumnRole) {
    setMapping((prev) => ({ ...prev, [columnIndex]: role }));
  }

  async function handleImport() {
    if (normalized.rows.length === 0) {
      toast.error("No valid rows to import.");
      return;
    }
    setImporting(true);
    try {
      const actionResult = await importBankTransactionsAction(filename, normalized.rows);
      if (actionResult.error) {
        toast.error(actionResult.error);
        return;
      }
      setResult({
        importedCount: actionResult.importedCount ?? 0,
        duplicateCount: actionResult.duplicateCount ?? 0,
      });
      setStep("done");
      router.refresh();
    } finally {
      setImporting(false);
    }
  }

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upload a statement</CardTitle>
          <CardDescription>CSV or Excel (.xlsx) export from your bank&apos;s online banking.</CardDescription>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="statement-file"
            className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center hover:bg-accent/50"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {parsing ? "Reading file…" : "Click to choose a .csv, .xlsx, or .xls file"}
            </span>
            <input
              id="statement-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="sr-only"
              onChange={handleFileChange}
              disabled={parsing}
            />
          </label>
        </CardContent>
      </Card>
    );
  }

  if (step === "map" && parsed) {
    const previewRows = normalized.rows.slice(0, 10);
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Map columns</CardTitle>
            <CardDescription>
              Tell us what each column in <span className="font-medium">{filename}</span> means.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Date format</Label>
                <Select
                  value={dateFormat}
                  onValueChange={(value) => value && setDateFormat(value)}
                  items={Object.fromEntries(DATE_FORMATS.map((f) => [f.value, f.label]))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="invert-amount"
                  checked={invertAmount}
                  onCheckedChange={(checked) => setInvertAmount(checked === true)}
                />
                <Label htmlFor="invert-amount" className="font-normal">
                  Invert signed amounts (use if deposits show as negative)
                </Label>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {parsed.headers.map((header, index) => (
                      <TableHead key={index} className="min-w-[160px]">
                        <div className="space-y-1">
                          <div className="truncate text-xs text-muted-foreground">{header || `Column ${index + 1}`}</div>
                          <Select
                            value={mapping[index] ?? "ignore"}
                            onValueChange={(value) => handleRoleChange(index, value as ColumnRole)}
                            items={COLUMN_ROLE_LABELS}
                          >
                            <SelectTrigger className="h-8 w-full text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map(([role, label]) => (
                                <SelectItem key={role} value={role}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, 5).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {parsed.headers.map((_, colIndex) => (
                        <TableCell key={colIndex} className="max-w-[160px] truncate text-xs">
                          {row[colIndex] ?? ""}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {!hasRequiredMapping ? (
          <p className="text-sm text-muted-foreground">
            Map a Date column, a Description column, and either an Amount column or Debit/Credit columns to continue.
          </p>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {normalized.rows.length} row{normalized.rows.length === 1 ? "" : "s"} ready to import
                {normalized.errors.length > 0
                  ? `, ${normalized.errors.length} row${normalized.errors.length === 1 ? "" : "s"} will be skipped`
                  : ""}
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell>{new Date(row.transaction_date).toLocaleDateString("en-ZA")}</TableCell>
                      <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                      <TableCell>{row.reference || "—"}</TableCell>
                      <TableCell className={`text-right ${row.amount < 0 ? "text-destructive" : ""}`}>
                        {formatCurrency(row.amount, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {normalized.rows.length > previewRows.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the first {previewRows.length} of {normalized.rows.length} rows.
                </p>
              ) : null}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setStep("upload")}>
            Back
          </Button>
          <Button disabled={!hasRequiredMapping || normalized.rows.length === 0 || importing} onClick={handleImport}>
            {importing ? "Importing…" : `Import ${normalized.rows.length} Row${normalized.rows.length === 1 ? "" : "s"}`}
            {!importing ? <ArrowRight /> : null}
          </Button>
        </div>
      </div>
    );
  }

  if (step === "done" && result) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <CardTitle>Import complete</CardTitle>
          </div>
          <CardDescription>
            {result.importedCount} new transaction{result.importedCount === 1 ? "" : "s"} imported
            {result.duplicateCount > 0
              ? `, ${result.duplicateCount} already-imported row${result.duplicateCount === 1 ? "" : "s"} skipped`
              : ""}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button
            onClick={() => {
              setStep("upload");
              setParsed(null);
              setResult(null);
              setFilename("");
            }}
          >
            Import Another File
          </Button>
          <Button variant="outline" onClick={() => router.push("/bank-reconciliation")}>
            Go to Reconciliation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
}
