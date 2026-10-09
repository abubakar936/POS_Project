# ShopEase POS frontend

## Run locally

```powershell
cd D:\POS_Project\frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
The development server proxies `/api` requests to the NestJS backend at
`http://localhost:3001` by default. Configure `VITE_BACKEND_URL` in a local
`.env` file if your backend uses another address. Start the backend in a
separate PowerShell window:

```powershell
cd D:\POS_Project\backend
npm install
npm run start:dev
```

Set
`VITE_API_BASE_URL` in a local `.env` file to change the API base URL.

## Products

The Products page uses the NestJS `/products`, `/categories`,
`/sub-categories`, `/companies`, `/vendors`, and `/stocks` endpoints. These
routes require a backend account; sign in from the Products page using the
account's email and password. The returned access token is saved in browser
local storage and attached to authenticated API requests.

The product list search is name-only because that is what the backend supports.
The backend does not currently provide category/subcategory list filters or a
bulk stock summary endpoint. Stock quantities are therefore totaled from stock
records for the visible product page. Tax and variant definitions are not part
of the current product API; only the existing `hasVariants` flag is editable.

## Stock / Inventory

The inventory page loads stock records and products from `/stocks` and
`/products`, then aggregates quantities by product. Search, category, and
stock-status filtering run against the loaded inventory because the stock list
API only supports product name search and product ID filtering. Adding stock
creates a stock lot with `POST /stocks`; the backend starts its remaining
quantity at the received quantity and requires an active vendor or company.
The backend does not expose stock movement history, quantity adjustments,
reasons, or notes, so the page does not offer those actions.

## Orders / Sales

The Orders / Sales page uses the authenticated `/orders` API for paginated
order records, order-number/customer/phone search, and order details. The
backend has no separate Sales API and does not store order, fulfillment, or
payment status. Invoices and payment summaries are loaded separately from
`/invoices` when viewing an order. Removing an un-invoiced order uses the
backend delete operation, which restores its reserved stock; invoiced orders
cannot be changed or removed.

## Categories

The Categories page uses `/categories` pagination, name search, status filtering,
and the existing create/detail/update endpoints. It counts subcategories from
their `categoryId` relationship. The API does not provide a product count by
category, and its delete guard only checks active subcategories, so the page
offers reversible activation/deactivation instead of deletion to preserve
existing references.

## Sign in

Open `http://localhost:5173/login` and sign in with an existing POS account.
The frontend posts `{ email, password }` to `/auth/login`, stores the returned
`access_token` in browser local storage, and sends it as a bearer token on
subsequent API requests. Protected application routes redirect to the sign-in
page and return to the requested page after a successful login. The backend
does not currently expose a logout or token-refresh endpoint.

## Production build

```powershell
npm run build
npm run preview
```

Dashboard examples are static visual-prototype data in
`src/features/dashboard/dashboard.data.ts`; no dashboard API endpoint is
currently wired.
