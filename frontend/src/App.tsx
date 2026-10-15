import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { CategoriesPage } from './features/categories/CategoriesPage';
import { PlaceholderPage } from './features/placeholder/PlaceholderPage';
import { ProductFormPage } from './features/products/ProductFormPage';
import { ProductsPage } from './features/products/ProductsPage';
import { SubcategoriesPage } from './features/subcategories/SubcategoriesPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { InvoicesPage } from './features/invoices/InvoicesPage';
import { UsersPage } from './features/users/UsersPage';
import { StocksPage } from './features/stocks/StocksPage';
import { VendorsPage } from './features/vendors/VendorsPage';
import { ACCESS_TOKEN_STORAGE_KEY } from './lib/api/client';
import { CustomersPage } from './features/customers/CustomersPage';

const NewSalePage = lazy(() =>
  import('./features/orders/NewSalePage').then((module) => ({
    default: module.NewSalePage,
  })),
);
const ReviewSalePage = lazy(() =>
  import('./features/orders/ReviewSalePage').then((module) => ({
    default: module.ReviewSalePage,
  })),
);
const SaleSuccessPage = lazy(() =>
  import('./features/orders/SaleSuccessPage').then((module) => ({
    default: module.SaleSuccessPage,
  })),
);

function RequireAuthentication() {
  const location = useLocation();
  if (!window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuthentication />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="sub-categories" element={<SubcategoriesPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<ProductFormPage />} />
          <Route path="products/:id/edit" element={<ProductFormPage />} />
          <Route path="pos" element={<Suspense fallback={<SalePageLoading />}><NewSalePage /></Suspense>} />
          <Route path="pos/review" element={<Suspense fallback={<SalePageLoading />}><ReviewSalePage /></Suspense>} />
          <Route path="pos/success" element={<Suspense fallback={<SalePageLoading />}><SaleSuccessPage /></Suspense>} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="stocks" element={<StocksPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="*" element={<PlaceholderPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function SalePageLoading() {
  return <div role="status" className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading sale workspace…</div>;
}
