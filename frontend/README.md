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

## Stock / Inventory

The inventory page displays individual stock lots with each lot's purchase
cost, selling price, remaining quantity, location, supplier, and remaining
cost value. The total on-hand value is calculated from the actual remaining
quantity and fixed purchase cost of each lot. A stock receipt initializes its
remaining quantity to the received quantity. Selling prices can be updated
through `PATCH /stocks/:id/sale-price`; recorded purchase cost and on-hand
quantity cannot be changed through stock update endpoints. Stock movement
history and adjustments are not available in the current backend.

## Invoices

The Invoices page uses the authenticated `/invoices` and `/orders` APIs. An
invoice is created from an existing order; the backend assigns its number and
copies the order's customer and financial snapshots. Duplicate invoices are
prevented by the backend, and invoice creation does not record a payment.
Invoice search supports invoice number, linked order number, customer name,
and phone. Date, customer, and payment-status filters are not available.

Invoice details and browser printing display server-returned order items,
discounts, totals, due date, and payments. The backend does not expose
itemized taxes or shop contact/profile details, so the printable copy identifies
those omissions rather than inventing them. Only invoice note and due date can
be edited. Payments can be recorded or removed; card/bank payment recording is
only a local POS record and does not process a charge. The backend permits
invoice deletion only when no active payments remain, and its duplicate guard
also counts deleted invoices, so deleting one prevents creating a replacement
for that order. Invoice cancellation and PDF export are not exposed.

## Users

The Users page uses `GET /users`, which the backend restricts to the `admin`
role. The sidebar only shows the Users link after `/auth/profile` confirms the
current user's role; direct requests are still protected by the backend.
The API returns only email, role, and timestamps for all users. Search, role
filtering, and pagination are applied client-side because the endpoint does not
accept those query parameters.

The backend currently has no Users create, edit, status, or delete endpoints.
Its user entity has no name or active-status field, so the page is read-only
and does not show those values or offer unsupported controls.

## Vendors

The Vendors page uses the authenticated `/vendors` list/detail/create/update
and soft-delete endpoints. The list supports backend pagination, search by
vendor name/company/email/primary phone, and active-status filtering. Vendor
names and emails are not unique in the current backend. Deactivation is
reversible; soft deletion is offered with a warning because the backend does
not check linked stock records before deleting.

Vendor details show stock-lot receipts associated with the vendor. The stock
list supports `vendorId` filtering and paginated results for this view. These
are the stock records currently available in the backend, not a separate
purchase ledger; outstanding balances and accounting purchase records are not
implemented.

## Customers

The Customers page uses the authenticated `/customers` CRUD endpoints and
shows the server-stored customer fields. Search supports customer names,
email, primary phone, and alternate phone; phone search is included in the
backend query. The page displays `current_balance` only as a stored customer
field because the backend does not update it from orders or payments. Total
purchases and an accounting outstanding-balance calculation are not exposed.

Customer order history is queried from `/orders` using the linked `customerId`
and paginated by the server. The order API now supports this optional filter.
Only orders linked by customer ID appear in this history; walk-in orders with
matching names or phone numbers are not inferred to belong to the customer.

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
