# Shipping desk

Turn an eBay Seller Hub orders CSV into rows on the **Ebay Live Shipping** Excel template (one row per unique Order number), then review potential duplicate deliveries before you export.

The app never merges separate orders, combines quantities, or changes References. Duplicate matches are review warnings, not proof that an order was placed twice.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open [http://127.0.0.1:43173](http://127.0.0.1:43173). Load `public/sample-ebay-orders.csv` or use **Load sample orders**.

## Deploy on Vercel

This app is a static Next.js front end. CSV parsing and Excel export run entirely in the browser. No database, server uploads, or environment secrets are required.

| Vercel setting | Value |
| --- | --- |
| Root Directory | The folder that contains this `package.json` (repository root if the repo is only this app) |
| Framework Preset | **Next.js** (auto-detected) |
| Build Command | `npm run build` (default) |
| Output Directory | *(leave empty — Next.js default)* |
| Install Command | `npm ci` when `package-lock.json` is committed, otherwise `npm install` |
| Node.js Version | **20.x** (matches `.nvmrc` and `engines.node`) |
| Environment Variables | **None required** |

Before connecting Vercel, push the full application tree, including `package.json`, `package-lock.json`, `public/ebay-live-shipping-template.xlsx`, and the **`src/` directory** (especially `src/app/page.tsx`). A linked repository that only contains `package.json` without `src/app/` will fail with:

`Couldn't find any pages or app directory`

**If you see that error:** open your GitHub repo in the browser. If you do not see `src/app/`, commit and push `src/` from this project. In Vercel → **Project Settings → General → Root Directory**, set the folder that contains both `package.json` and `src/app` (leave blank when the repo root *is* that folder). Redeploy.

After deploy, smoke-test in production: load a sample CSV, open duplicate review, and download the Excel file. The export must still match `public/ebay-live-shipping-template.xlsx` exactly.

## What it does

1. Reads a Seller Hub orders report (CSV).
2. Groups CSV rows by **Order number** (or **Sales record number** when Order number is blank) and keeps the **first row** of each order for shipping. Extra item-detail rows are counted as repeats, not extra orders.
3. Shows totals for unique orders, repeated rows, and potential duplicate deliveries.
4. Compares recipient details across different Order numbers and lists possible duplicate delivery groups in a dedicated tab.
5. Lets you open an order, edit delivery details, mark a group as **Reviewed — keep separate**, and explicitly exclude orders from export.
6. Downloads an `.xlsx` file built from `public/ebay-live-shipping-template.xlsx`. Row 1, column order, widths, and worksheet name match that template exactly; converted orders start on row 2. **Reference** is the original Order number.

Use **Shipping settings** to adjust sender and package defaults (prefilled from the template). **Excel export** preview uses the same column headers as the download.

## Duplicate matching

After first-row-per-order grouping, orders match when all of these fields are the same:

- Post to name
- Post to phone
- Post to address 1
- Post to city
- Post to county
- Post to postcode
- Post to country

`Post to address 2` is not part of the match key. If it differs — including blank versus filled, or eBay codes such as `W/N` — the group is still flagged and those cells are highlighted.

Comparison is conservative:

- Trim whitespace, ignore case, and collapse repeated spaces
- Normalize country names to a country code
- Compare UK postcodes without case or spacing differences
- Strip phone spacing and punctuation without guessing missing country codes
- Skip orders that are missing required delivery fields
- No fuzzy name or address matching

Original values are kept for display and export.

## Template

The authoritative export layout is `public/ebay-live-shipping-template.xlsx` (worksheet **Ebay Live Shipping 24**, 38 columns). Header names and order are defined in `src/lib/template-metadata.json` and verified in tests. If the template cannot be loaded or Row 1 does not match, export fails with a clear error instead of falling back to a generic format.