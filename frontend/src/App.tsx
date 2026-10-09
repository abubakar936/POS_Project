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
import { StocksPage } from './features/stocks/StocksPage';
import { ACCESS_TOKEN_STORAGE_KEY } from './lib/api/client';

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
          <Route path="orders" element={<OrdersPage />} />
          <Route path="stocks" element={<StocksPage />} />
          <Route path="*" element={<PlaceholderPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
