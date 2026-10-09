# ShopEase POS frontend

## Run locally

```powershell
cd D:\POS_Project\frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`).
The development server proxies `/api` requests to the NestJS backend at
`http://localhost:3000`. Start the backend in a separate PowerShell window:

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

## Categories

The Categories page uses `/categories` pagination, name search, status filtering,
and the existing create/detail/update endpoints. It counts subcategories from
their `categoryId` relationship. The API does not provide a product count by
category, and its delete guard only checks active subcategories, so the page
offers reversible activation/deactivation instead of deletion to preserve
existing references.

## Production build

```powershell
npm run build
npm run preview
```

Dashboard examples are static visual-prototype data in
`src/features/dashboard/dashboard.data.ts`; no dashboard API endpoint is
currently wired.
