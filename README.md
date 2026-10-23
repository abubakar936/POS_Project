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

## Product catalogue import and images

The importer uses the existing `products`, `categories`, and `sub_categories`
tables. Run the additive metadata migration before importing. It adds nullable
`imageUrl`, `imagePath`, `nickname`, and `marketName` columns without dropping
or recreating any table.

From PowerShell:

```powershell
Set-Location D:\POS_Project\backend
npm install
npm run db:migration:show
npm run db:migration:run
```

The TypeORM CLI loads the existing `backend/.env` database settings and shares
the entity list and connection configuration with NestJS. Production retains
`synchronize: false`.

The supplied CSV is available at `backend\src\alfatah_lahore_products.csv`.
Preview it first. The preview reports category values and their
frequency, existing/missing status, and product inserts/skips. This dataset has
53 distinct values in its `category` column, including values that appear to be
brands. The importer uses the CSV category values as provided.

```powershell
npm run catalog:import -- --file "src\alfatah_lahore_products.csv" --dry-run
```

After reviewing the dry-run output, run the import directly:

```powershell
npm run catalog:import -- --file "src\alfatah_lahore_products.csv" --apply
```

The importer preserves product names exactly, including leading/trailing
spaces, and ignores `price_pkr` and all unrelated source metadata. It leaves
prices, identifiers, vendor/company links, and stock quantities unset. Existing
product names (including soft-deleted records) and duplicate names within the
CSV are skipped rather than overwritten. Missing categories are
created from the CSV category values. The current CSV has no populated
`subcategory` values, so imported products will have no subcategory. Invalid
rows and errors are summarized; rerunning is safe.

`image_url` values are stored as `imageUrl` and can render while online. An
external URL alone cannot render offline. To keep images available offline,
first preview image candidates and then explicitly run the downloader:

```powershell
npm run catalog:download-images -- --dry-run
npm run catalog:download-images -- --apply
```

The downloader permits public HTTPS hosts only; validates redirects and DNS
addresses; accepts JPEG, PNG, GIF, or WebP signatures; enforces a 5 MiB limit
and a timeout; and generates filenames from product UUIDs. It saves files under
`backend\uploads\product-images`, served through `/assets/product-images`, and
stores that relative URL in `imagePath`. The frontend prefers this local image
when available, then falls back to `imageUrl`. Keep the uploads directory on
persistent storage and back it up; it is intentionally git-ignored.

Products and categories do not have tenant/company ownership fields in the
current schema. This feature follows the existing global catalog behavior and
does not invent tenant isolation.
