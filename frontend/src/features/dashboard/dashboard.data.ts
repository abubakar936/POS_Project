export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down';
  comparison: string;
}

export interface Transaction {
  invoice: string;
  customer: string;
  items: number;
  total: string;
  method: string;
  time: string;
}

export interface TopProduct {
  name: string;
  category: string;
  units: number;
  revenue: string;
  color: string;
  initials: string;
}

export interface LowStockProduct {
  name: string;
  remaining: number;
  unit: string;
  color: string;
  initials: string;
}

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: 'Sales today',
    value: 'Rs. 48,750',
    change: '12%',
    direction: 'up',
    comparison: 'vs. yesterday',
  },
  {
    label: 'Total orders',
    value: '18',
    change: '20%',
    direction: 'up',
    comparison: 'vs. yesterday',
  },
  {
    label: 'Total customers',
    value: '1,284',
    change: '9%',
    direction: 'up',
    comparison: 'this month',
  },
  {
    label: 'Profit today',
    value: 'Rs. 16,240',
    change: '15%',
    direction: 'up',
    comparison: 'vs. yesterday',
  },
];

export const salesOverview = [
  { day: '02 Oct', sales: 18 },
  { day: '03 Oct', sales: 27 },
  { day: '04 Oct', sales: 32 },
  { day: '05 Oct', sales: 29 },
  { day: '06 Oct', sales: 41 },
  { day: '07 Oct', sales: 36 },
  { day: '08 Oct', sales: 52 },
];

export const topProducts: TopProduct[] = [
  {
    name: 'Chicken Burger',
    category: 'Burgers',
    units: 32,
    revenue: 'Rs. 14,720',
    color: 'bg-amber-100 text-amber-800',
    initials: 'CB',
  },
  {
    name: 'French Fries',
    category: 'Sides',
    units: 28,
    revenue: 'Rs. 7,000',
    color: 'bg-orange-100 text-orange-800',
    initials: 'FF',
  },
  {
    name: 'Cold Drink 500ml',
    category: 'Drinks',
    units: 24,
    revenue: 'Rs. 3,600',
    color: 'bg-rose-100 text-rose-800',
    initials: 'CD',
  },
  {
    name: 'Pizza Large',
    category: 'Pizza',
    units: 18,
    revenue: 'Rs. 21,600',
    color: 'bg-yellow-100 text-yellow-800',
    initials: 'PL',
  },
  {
    name: 'Chocolate Cake',
    category: 'Desserts',
    units: 12,
    revenue: 'Rs. 9,600',
    color: 'bg-stone-200 text-stone-800',
    initials: 'CC',
  },
];

export const recentTransactions: Transaction[] = [
  {
    invoice: 'INV-1008',
    customer: 'Walk-in Customer',
    items: 3,
    total: 'Rs. 1,250',
    method: 'Cash',
    time: '10:15 AM',
  },
  {
    invoice: 'INV-1007',
    customer: 'Ahmed Khan',
    items: 2,
    total: 'Rs. 780',
    method: 'Card',
    time: '09:52 AM',
  },
  {
    invoice: 'INV-1006',
    customer: 'Fatima Store',
    items: 5,
    total: 'Rs. 2,450',
    method: 'Cash',
    time: '09:30 AM',
  },
  {
    invoice: 'INV-1005',
    customer: 'Usman Ali',
    items: 1,
    total: 'Rs. 450',
    method: 'Bank transfer',
    time: '09:12 AM',
  },
  {
    invoice: 'INV-1004',
    customer: 'Walk-in Customer',
    items: 4,
    total: 'Rs. 1,980',
    method: 'Cash',
    time: '08:47 AM',
  },
];

export const lowStockProducts: LowStockProduct[] = [
  {
    name: 'Coca Cola 500ml',
    remaining: 12,
    unit: 'left',
    color: 'bg-rose-100 text-rose-800',
    initials: 'CC',
  },
  {
    name: 'Lays Classic Chips',
    remaining: 5,
    unit: 'left',
    color: 'bg-amber-100 text-amber-800',
    initials: 'LC',
  },
  {
    name: 'Bread (Loaf)',
    remaining: 3,
    unit: 'left',
    color: 'bg-orange-100 text-orange-800',
    initials: 'BR',
  },
];
