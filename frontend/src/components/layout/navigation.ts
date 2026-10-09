import {
  Boxes,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const navigationItems: NavigationItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'POS / New Sale', path: '/pos', icon: ShoppingCart },
  { label: 'Products', path: '/products', icon: Package },
  { label: 'Categories', path: '/categories', icon: Boxes },
  { label: 'Subcategories', path: '/sub-categories', icon: Tags },
  { label: 'Orders / Sales', path: '/orders', icon: ClipboardList },
  { label: 'Invoices', path: '/invoices', icon: FileText },
  { label: 'Stock / Inventory', path: '/stocks', icon: Warehouse },
  { label: 'Customers', path: '/customers', icon: Users },
  { label: 'Vendors', path: '/vendors', icon: Truck },
  { label: 'Users', path: '/users', icon: Users },
  { label: 'Settings', path: '/settings', icon: Settings },
];
