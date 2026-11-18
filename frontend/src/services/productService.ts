import type { Page } from "@/types/common";
import type {
  Category,
  CategoryInput,
  CategoryUpdate,
  PopularProduct,
  PriceUpdate,
  Product,
  ProductCreate,
  ProductDetail,
  ProductListQuery,
  ProductUpdate,
} from "@/types/catalog";
import { apiClient } from "./apiClient";

export const productService = {
  categories: () => apiClient.get<Category[]>("/categories"),
  createCategory: (body: CategoryInput) => apiClient.post<Category>("/categories", body),
  updateCategory: (id: string, body: CategoryUpdate) =>
    apiClient.patch<Category>(`/categories/${id}`, body),
  deleteCategory: (id: string) => apiClient.delete(`/categories/${id}`),

  list: (query?: ProductListQuery) => apiClient.get<Page<Product>>("/products", { query }),
  popular: (limit = 10) => apiClient.get<PopularProduct[]>("/products/popular", { query: { limit } }),
  detail: (id: string) => apiClient.get<ProductDetail>(`/products/${id}/detail`),
  create: (body: ProductCreate) => apiClient.post<ProductDetail>("/products", body),
  update: (id: string, body: ProductUpdate) => apiClient.patch<ProductDetail>(`/products/${id}`, body),
  updatePrice: (id: string, body: PriceUpdate) =>
    apiClient.patch<ProductDetail>(`/products/${id}/price`, body),
  updateStock: (id: string, stock_quantity: number) =>
    apiClient.put<Product>(`/products/${id}/stock`, { stock_quantity }),
  discontinue: (id: string) => apiClient.delete(`/products/${id}`),
};
