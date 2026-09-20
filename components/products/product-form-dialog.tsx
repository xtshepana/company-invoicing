"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createProductAction, updateProductAction } from "@/server/actions/product-actions";
import type { Product } from "@/server/services/products";

export function ProductFormDialog({ product, defaultVatRate }: { product?: Product; defaultVatRate: number }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(product?.type ?? "product");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const action = product ? updateProductAction : createProductAction;
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.success) {
        toast.success(product ? "Item updated." : "Item added.");
        setOpen(false);
        router.refresh();
      } else if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={product ? <Button variant="ghost" size="icon" /> : <Button />}>
        {product ? <Pencil className="h-4 w-4" /> : (
          <>
            <Plus /> Add Item
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product ? "Edit item" : "Add a product or service"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {product ? <input type="hidden" name="id" value={product.id} /> : null}
          <div className="space-y-2">
            <Label htmlFor={`type-${product?.id ?? "new"}`}>Type</Label>
            <Select
              name="type"
              value={type}
              onValueChange={(v) => v && setType(v as Product["type"])}
              items={{ product: "Product", service: "Service" }}
            >
              <SelectTrigger id={`type-${product?.id ?? "new"}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`name-${product?.id ?? "new"}`}>Name</Label>
            <Input id={`name-${product?.id ?? "new"}`} name="name" defaultValue={product?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`sku-${product?.id ?? "new"}`}>SKU</Label>
              <Input id={`sku-${product?.id ?? "new"}`} name="sku" defaultValue={product?.sku} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`unit-${product?.id ?? "new"}`}>Unit</Label>
              <Input id={`unit-${product?.id ?? "new"}`} name="unit" defaultValue={product?.unit ?? "each"} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`description-${product?.id ?? "new"}`}>Description</Label>
            <Textarea id={`description-${product?.id ?? "new"}`} name="description" defaultValue={product?.description} rows={2} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`cost_price-${product?.id ?? "new"}`}>Cost price</Label>
              <Input
                id={`cost_price-${product?.id ?? "new"}`}
                name="cost_price"
                type="number"
                step="0.01"
                min={0}
                defaultValue={product?.cost_price ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`selling_price-${product?.id ?? "new"}`}>Selling price</Label>
              <Input
                id={`selling_price-${product?.id ?? "new"}`}
                name="selling_price"
                type="number"
                step="0.01"
                min={0}
                defaultValue={product?.selling_price ?? 0}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`vat_rate-${product?.id ?? "new"}`}>VAT rate (%)</Label>
              <Input
                id={`vat_rate-${product?.id ?? "new"}`}
                name="vat_rate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                defaultValue={product?.vat_rate ?? defaultVatRate}
                required
              />
            </div>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : product ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
