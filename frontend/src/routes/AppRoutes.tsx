import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { FullPageSpinner, HomeRedirect, ProtectedRoute, RoleRoute } from "./guards";

// Route-level code splitting keeps the cashier's first load small.
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const PosPage = lazy(() => import("@/features/orders/PosPage"));
const OrdersPage = lazy(() => import("@/features/orders/OrdersPage"));
const CustomersPage = lazy(() => import("@/features/customers/CustomersPage"));
const CustomerDetailPage = lazy(() => import("@/features/customers/CustomerDetailPage"));
const ProductsPage = lazy(() => import("@/features/products/ProductsPage"));
const PaymentsPage = lazy(() => import("@/features/payments/PaymentsPage"));
const DuesPage = lazy(() => import("@/features/payments/DuesPage"));
const ExpensesPage = lazy(() => import("@/features/expenses/ExpensesPage"));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage"));
const UsersPage = lazy(() => import("@/features/users/UsersPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const NotFoundPage = lazy(() => import("@/features/auth/NotFoundPage"));

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route element={<RoleRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos" element={<PosPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/dues" element={<DuesPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/employees" element={<UsersPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
