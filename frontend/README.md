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

## Production build

```powershell
npm run build
npm run preview
```

Dashboard examples are static visual-prototype data in
`src/features/dashboard/dashboard.data.ts`; no dashboard API endpoint is
currently wired.
