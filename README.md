# POS Project

This repository contains the POS API and its React frontend.

## Backend

```powershell
cd D:\POS_Project\backend
npm install
npm run start:dev
```

Configure the backend environment using `backend/.env.example`. Keep actual
credentials in the ignored `backend/.env` file.

## Frontend

```powershell
cd D:\POS_Project\frontend
npm install
npm run dev
```

The Vite development server runs on port 5173 and proxies `/api` requests to
the backend at `http://localhost:3000`.
