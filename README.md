# Fieldnote

Field service reports, customer history, maintenance contracts, and private photo/PDF attachments.

## Website

The Cloudflare upload files are in `cloudflare/`. Deploy every file in this directory together to the existing Cloudflare Worker. `config.js` contains the browser-safe Supabase URL and publishable key; never use a secret or service_role key there.

The offline preview is `fieldnote-maintenance-offline.html`. Open it in a browser to test without internet. Test data stays in that browser and does not change hosted records.

## Supabase

For a new project, run `supabase/setup.sql`, then `maintenance.sql`, then `pdf-attachments.sql`. For the existing project, run only scripts that have not already been applied. Create website users and grant membership using a privately filled copy of `add-team.example.sql`.

Contracts support 3, 4, 6 or 12 month intervals, covered equipment, and contract periods. Completing a linked report completes a scheduled visit. Photos and PDFs use private storage with temporary view links. The next outstanding date is highlighted on each contract.

## Verify

No packages are required for these checks:

```sh
node tests/maintenance.cjs
node tests/maintenance-api.cjs
node tests/offline.cjs
node tests/pdf-and-highlights.cjs
```

API checks use mocks; SQL migrations and live browser behavior require testing against the actual project.

## Change workflow

The owner requests that every completed webpage change be committed and pushed to the selected GitHub repository. Future updates should include source, SQL additions when needed, and relevant checks. Never include browser test data, local database files, uploaded customer documents, passwords or secret API keys. GitHub synchronization does not deploy to Cloudflare unless separately configured.

## Create upload files

```sh
python scripts/build-offline.py
python scripts/package.py
```

The deploy ZIP is created in `dist/`.

Photos are compressed in the browser before upload or offline saving, with a maximum output edge of 1600 pixels and quality 82%. PNG/WebP transparency is preserved. A smaller original is retained instead of increasing file size. Photo inputs may be up to 30 MB; stored attachments must be under 10 MB. PDFs are unchanged. Existing stored photos are not recompressed. No SQL update is required.
