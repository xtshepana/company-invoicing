import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ProductFormDialog } from "@/components/products/product-form-dialog";
import { ArchiveProductButton } from "@/components/products/archive-product-button";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listProducts } from "@/server/services/products";
import { productSearchSchema } from "@/lib/validations/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Products & Services" };

interface ProductsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const TYPE_LABELS: Record<string, string> = { product: "Product", service: "Service" };

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "products")) redirect("/dashboard");

  const params = productSearchSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listProducts(params), getCompanySettings()]);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.type !== "all") sp.set("type", params.type);
    if (params.status !== "active") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/products?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products & Services</h1>
          <p className="text-muted-foreground">Reusable line items for quotes and invoices.</p>
        </div>
        <ProductFormDialog defaultVatRate={settings.default_vat_rate} />
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by name, SKU, description…"
        selects={[
          {
            param: "type",
            value: params.type,
            options: [
              { value: "all", label: "All types" },
              { value: "product", label: "Products" },
              { value: "service", label: "Services" },
            ],
          },
          {
            param: "status",
            value: params.status,
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Package className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q || params.status !== "active" || params.type !== "all"
                  ? "No items match your filters."
                  : "No products or services have been added yet."}
              </p>
              {!params.q && params.status === "active" && params.type === "all" ? (
                <ProductFormDialog defaultVatRate={settings.default_vat_rate} />
              ) : null}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">Products and services</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Selling price</TableHead>
                  <TableHead>VAT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{TYPE_LABELS[product.type]}</TableCell>
                    <TableCell>{product.sku || "—"}</TableCell>
                    <TableCell>
                      {formatCurrency(product.selling_price, settings.default_currency)}
                      <span className="text-muted-foreground"> / {product.unit}</span>
                    </TableCell>
                    <TableCell>{product.vat_rate}%</TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Active" : "Archived"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <ProductFormDialog product={product} defaultVatRate={settings.default_vat_rate} />
                      <ArchiveProductButton productId={product.id} isActive={product.is_active} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar page={result.page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
