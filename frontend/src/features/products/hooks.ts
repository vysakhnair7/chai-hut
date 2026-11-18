import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { useApiMutation } from "@/hooks/useApiMutation";
import { productService } from "@/services/productService";
import type {
  CategoryInput,
  CategoryUpdate,
  PriceUpdate,
  ProductCreate,
  ProductListQuery,
  ProductUpdate,
} from "@/types/catalog";

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories, queryFn: productService.categories });
}

export function useProducts(query: ProductListQuery) {
  return useQuery({
    queryKey: queryKeys.products(query),
    queryFn: () => productService.list(query),
    placeholderData: keepPreviousData,
  });
}

/** The whole menu in one request (the backend caps a page at 200), for pickers. */
export function useMenu() {
  return useProducts({ limit: 200 });
}

/** Best sellers, shown as one-tap chips on the POS (useful for walk-ins, who have no personal history). */
export function usePopularProducts(limit = 6) {
  return useQuery({
    queryKey: queryKeys.popularProducts(limit),
    queryFn: () => productService.popular(limit),
    staleTime: 60_000,
  });
}

export function useProductDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.productDetail(id ?? "none"),
    queryFn: () => productService.detail(id as string),
    enabled: id !== null,
  });
}

const PRODUCT_KEYS = [["products"], ["product-detail"], ["popular-products"]];

export function useCreateProduct(onDone?: () => void) {
  return useApiMutation((body: ProductCreate) => productService.create(body), {
    success: (p) => `Added ${p.name}`,
    invalidate: PRODUCT_KEYS,
    toastError: false,
    onSuccess: onDone,
  });
}

export function useUpdateProduct(id: string, onDone?: () => void) {
  return useApiMutation((body: ProductUpdate) => productService.update(id, body), {
    success: "Product updated",
    invalidate: PRODUCT_KEYS,
    toastError: false,
    onSuccess: onDone,
  });
}

export function useUpdatePrice(id: string, onDone?: () => void) {
  return useApiMutation((body: PriceUpdate) => productService.updatePrice(id, body), {
    success: "Price updated",
    invalidate: PRODUCT_KEYS,
    toastError: false,
    onSuccess: onDone,
  });
}

export function useUpdateStock(id: string, onDone?: () => void) {
  return useApiMutation((stock: number) => productService.updateStock(id, stock), {
    success: "Stock updated",
    invalidate: PRODUCT_KEYS,
    toastError: false,
    onSuccess: onDone,
  });
}

export function useDiscontinueProduct(id: string, onDone?: () => void) {
  return useApiMutation(() => productService.discontinue(id), {
    success: "Product discontinued",
    invalidate: PRODUCT_KEYS,
    onSuccess: onDone,
  });
}

export function useCreateCategory(onDone?: () => void) {
  return useApiMutation((body: CategoryInput) => productService.createCategory(body), {
    success: "Category added",
    invalidate: [queryKeys.categories],
    toastError: false,
    onSuccess: onDone,
  });
}

export function useUpdateCategory(id: string, onDone?: () => void) {
  return useApiMutation((body: CategoryUpdate) => productService.updateCategory(id, body), {
    success: "Category updated",
    invalidate: [queryKeys.categories, ["products"]],
    toastError: false,
    onSuccess: onDone,
  });
}
