import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FormDialog } from "@/components/common/FormDialog";
import { FormField } from "@/components/common/FormField";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Category, Product, ProductDetail } from "@/types/catalog";
import { getErrorMessage } from "@/utils/errors";
import { applyServerFieldErrors } from "@/utils/forms";
import { formatMoney } from "@/utils/format";
import {
  useCreateProduct,
  useProductDetail,
  useUpdatePrice,
  useUpdateProduct,
  useUpdateStock,
} from "./hooks";
import {
  priceSchema,
  productCreateSchema,
  productEditSchema,
  stockSchema,
  type PriceValues,
  type ProductCreateValues,
  type ProductEditValues,
  type StockValues,
} from "./schemas";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function CategoryOptions({ categories }: { categories: Category[] }) {
  return (
    <>
      <option value="">Choose…</option>
      {categories
        .filter((c) => c.status === "active")
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
    </>
  );
}

/** Owner only: add a new menu item. */
export function ProductCreateDialog({ open, onOpenChange, categories }: DialogProps & { categories: Category[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProductCreateValues>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: { category_id: "", name: "", description: "", mrp: "", cost_price: "", gst_rate: "", stock_quantity: "0" },
  });
  useEffect(() => {
    if (open) {
      reset();
      setFormError(null);
    }
  }, [open, reset]);

  const create = useCreateProduct(() => onOpenChange(false));
  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    create.mutate(
      {
        category_id: v.category_id,
        name: v.name,
        description: v.description || null,
        mrp: v.mrp,
        cost_price: v.cost_price || null,
        gst_rate: v.gst_rate || null,
        stock_quantity: Number(v.stock_quantity),
      },
      {
        onError: (e) => {
          if (!applyServerFieldErrors(e, setError, ["category_id", "name", "description", "mrp", "cost_price", "gst_rate", "stock_quantity"]))
            setFormError(getErrorMessage(e));
        },
      },
    );
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Add product" submitLabel="Add product" submitting={create.isPending} onSubmit={onSubmit} error={formError}>
      <FormField label="Name" htmlFor="p-name" error={errors.name?.message}>
        <Input id="p-name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField label="Category" htmlFor="p-category" error={errors.category_id?.message}>
        <Select id="p-category" aria-invalid={!!errors.category_id} {...register("category_id")}>
          <CategoryOptions categories={categories} />
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Selling price (MRP, ₹)" htmlFor="p-mrp" error={errors.mrp?.message}>
          <Input id="p-mrp" inputMode="decimal" aria-invalid={!!errors.mrp} {...register("mrp")} />
        </FormField>
        <FormField label="Cost price (₹)" htmlFor="p-cost" error={errors.cost_price?.message} hint="Optional, but profit needs it">
          <Input id="p-cost" inputMode="decimal" aria-invalid={!!errors.cost_price} {...register("cost_price")} />
        </FormField>
        <FormField label="GST rate (%)" htmlFor="p-gst" error={errors.gst_rate?.message} hint="Blank = café default">
          <Input id="p-gst" inputMode="decimal" aria-invalid={!!errors.gst_rate} {...register("gst_rate")} />
        </FormField>
        <FormField label="Opening stock" htmlFor="p-stock" error={errors.stock_quantity?.message}>
          <Input id="p-stock" inputMode="numeric" aria-invalid={!!errors.stock_quantity} {...register("stock_quantity")} />
        </FormField>
      </div>
      <FormField label="Description" htmlFor="p-desc" error={errors.description?.message}>
        <Textarea id="p-desc" {...register("description")} />
      </FormField>
    </FormDialog>
  );
}

/** Owner only: name, category, description, GST and status. Price and stock have their own dialogs. */
export function ProductEditDialog({
  open,
  onOpenChange,
  product,
  categories,
}: DialogProps & { product: Product; categories: Category[] }) {
  const [formError, setFormError] = useState<string | null>(null);
  const defaults: ProductEditValues = {
    category_id: product.category_id,
    name: product.name,
    description: product.description ?? "",
    gst_rate: product.gst_rate,
    status: product.status,
  };
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProductEditValues>({ resolver: zodResolver(productEditSchema), defaultValues: defaults });
  useEffect(() => {
    if (open) {
      reset({
        category_id: product.category_id,
        name: product.name,
        description: product.description ?? "",
        gst_rate: product.gst_rate,
        status: product.status,
      });
      setFormError(null);
    }
  }, [open, product, reset]);

  const update = useUpdateProduct(product.id, () => onOpenChange(false));
  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(
      {
        category_id: v.category_id,
        name: v.name,
        description: v.description || null,
        ...(v.gst_rate ? { gst_rate: v.gst_rate } : {}),
        status: v.status,
      },
      {
        onError: (e) => {
          if (!applyServerFieldErrors(e, setError, ["category_id", "name", "description", "gst_rate", "status"]))
            setFormError(getErrorMessage(e));
        },
      },
    );
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Edit ${product.name}`} submitLabel="Save changes" submitting={update.isPending} onSubmit={onSubmit} error={formError}>
      <FormField label="Name" htmlFor="pe-name" error={errors.name?.message}>
        <Input id="pe-name" aria-invalid={!!errors.name} {...register("name")} />
      </FormField>
      <FormField label="Category" htmlFor="pe-category" error={errors.category_id?.message}>
        <Select id="pe-category" {...register("category_id")}>
          <CategoryOptions categories={categories} />
        </Select>
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="GST rate (%)" htmlFor="pe-gst" error={errors.gst_rate?.message}>
          <Input id="pe-gst" inputMode="decimal" {...register("gst_rate")} />
        </FormField>
        <FormField label="Status" htmlFor="pe-status" error={errors.status?.message}>
          <Select id="pe-status" {...register("status")}>
            <option value="available">Available</option>
            <option value="out_of_stock">Out of stock</option>
            <option value="discontinued">Discontinued</option>
          </Select>
        </FormField>
      </div>
      <FormField label="Description" htmlFor="pe-desc" error={errors.description?.message}>
        <Textarea id="pe-desc" {...register("description")} />
      </FormField>
    </FormDialog>
  );
}

/** Owner and manager: selling price and cost price. Cost and margin come from the manager-only detail view. */
export function PriceDialog({ open, onOpenChange, product }: DialogProps & { product: Product }) {
  const detail = useProductDetail(open ? product.id : null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PriceValues>({ resolver: zodResolver(priceSchema), defaultValues: { mrp: "", cost_price: "" } });
  useEffect(() => {
    if (open) {
      reset({ mrp: product.mrp, cost_price: "" });
      setFormError(null);
    }
  }, [open, product, reset]);

  const update = useUpdatePrice(product.id, () => onOpenChange(false));
  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(
      { ...(v.mrp ? { mrp: v.mrp } : {}), ...(v.cost_price ? { cost_price: v.cost_price } : {}) },
      {
        onError: (e) => {
          if (!applyServerFieldErrors(e, setError, ["mrp", "cost_price"])) setFormError(getErrorMessage(e));
        },
      },
    );
  });

  const d: ProductDetail | undefined = detail.data;
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Price: ${product.name}`}
      description={
        d
          ? `Current cost ${d.cost_price === null ? "not set" : formatMoney(d.cost_price)}${d.margin === null ? "" : ` · margin ${formatMoney(d.margin)}`}`
          : undefined
      }
      submitLabel="Update price"
      submitting={update.isPending}
      onSubmit={onSubmit}
      error={formError}
    >
      <FormField label="Selling price (MRP, ₹)" htmlFor="pr-mrp" error={errors.mrp?.message}>
        <Input id="pr-mrp" inputMode="decimal" aria-invalid={!!errors.mrp} {...register("mrp")} />
      </FormField>
      <FormField label="Cost price (₹)" htmlFor="pr-cost" error={errors.cost_price?.message} hint="Leave blank to keep the current cost">
        <Input id="pr-cost" inputMode="decimal" aria-invalid={!!errors.cost_price} {...register("cost_price")} />
      </FormField>
    </FormDialog>
  );
}

/** Owner and manager: set the stock count. */
export function StockDialog({ open, onOpenChange, product }: DialogProps & { product: Product }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StockValues>({ resolver: zodResolver(stockSchema), defaultValues: { stock_quantity: "0" } });
  useEffect(() => {
    if (open) {
      reset({ stock_quantity: String(product.stock_quantity) });
      setFormError(null);
    }
  }, [open, product, reset]);

  const update = useUpdateStock(product.id, () => onOpenChange(false));
  const onSubmit = handleSubmit((v) => {
    setFormError(null);
    update.mutate(Number(v.stock_quantity), {
      onError: (e) => {
        if (!applyServerFieldErrors(e, setError, ["stock_quantity"])) setFormError(getErrorMessage(e));
      },
    });
  });

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Stock: ${product.name}`} submitLabel="Update stock" submitting={update.isPending} onSubmit={onSubmit} error={formError}>
      <FormField label="Units in stock" htmlFor="st-qty" error={errors.stock_quantity?.message}>
        <Input id="st-qty" inputMode="numeric" aria-invalid={!!errors.stock_quantity} {...register("stock_quantity")} />
      </FormField>
    </FormDialog>
  );
}
