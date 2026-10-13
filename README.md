# Fieldnote

Field service reports, customer history, maintenance contracts, and private photo/PDF attachments.

## Live website

Fieldnote is live at https://fieldnote.valsystech.com.sg/ on cPanel PHP 8.4 and MySQL. Use `cpanel/public/` as the production webpage source. The owner uploads updates with cPanel File Manager into `/home/valsyste/fieldnote.valsystech.com.sg`. GitHub synchronization and live deployment are separate actions.

Private configuration and attachments live in `/home/valsyste/fieldnote-private`. Never commit passwords, private configuration, backups, runtime records, customer uploads, or generated ZIPs.

The interface uses a blue theme and responsive layouts. Customers can be added before their first service visit and edited through **Customers → select a customer → Edit customer**. Customer profile forms do not show name suggestions; service report and contract forms do. Cancel closes new and editing forms without saving.

See [cpanel/README.md](cpanel/README.md) for hosting and historical migration details, [customer management](cpanel/CUSTOMERS-UPDATE.md) for upload files and live verification, [customer suggestions](cpanel/CUSTOMER-SUGGESTIONS.md), and [blue theme/mobile layout](cpanel/BLUE-THEME-UPDATE.md).

## Legacy sources and offline preview

`cloudflare/` and `supabase/` are retained legacy sources from before the completed cPanel migration. They are not the current deployment target. The legacy `config.js` contains a browser-safe Supabase URL and publishable key; never use a secret or service_role key there.

The offline preview is `fieldnote-maintenance-offline.html`. Open it in a browser to test without internet. Test data stays in that browser and does not change hosted records.

### Legacy Supabase setup

For a new project, run `supabase/setup.sql`, then `maintenance.sql`, then `pdf-attachments.sql`. For the existing project, run only scripts that have not already been applied. Create website users and grant membership using a privately filled copy of `add-team.example.sql`.

Contracts support 3, 4, 6 or 12 month intervals, covered equipment, and contract periods. Completing a linked report completes a scheduled visit. Photos and PDFs use private storage with temporary view links. The next outstanding date is highlighted on each contract.

## Verify

Production checks include:

```sh
node tests/cpanel-adapter.cjs
node tests/customer-directory.cjs
node tests/customer-suggestions.cjs
php -l cpanel/public/api.php
php -l cpanel/public/customer-records.php
php tests/customer-records.php
```

Run `node tests/cpanel-layout.cjs` with Playwright on `NODE_PATH` and Microsoft Edge installed, or set `FIELDNOTE_BROWSER` to a compatible Chromium executable. It uses synthetic records, covers layouts from 320–1440px and customer/report/contract workflows, and does not contact production. Screenshots are generated under ignored `dist/layout-check/`.

The PHP customer storage test uses an isolated storage boundary, not production MySQL. Live browser verification is documented separately in [CUSTOMERS-UPDATE.md](cpanel/CUSTOMERS-UPDATE.md).

Legacy/offline checks require no packages:

```sh
node tests/maintenance.cjs
node tests/maintenance-api.cjs
node tests/offline.cjs
node tests/pdf-and-highlights.cjs
```

API checks use mocks; they do not establish deployment or live database correctness.

## Change workflow

Commit and push every completed change to https://github.com/joohock86/Fieldnote, together with relevant Markdown updates and checks. Inspect the diff before committing. Record live verification after the owner uploads the update; never claim deployment from a GitHub push alone. Never include browser test data, local database files, uploaded customer documents, passwords or secret API keys.

## Legacy/offline packaging

```sh
python scripts/build-offline.py
python scripts/package.py
```

These scripts create legacy/offline artifacts in `dist/`. Current cPanel updates should be packaged from the changed files in `cpanel/public/`, placed at the archive root, and uploaded according to the relevant cPanel update document.

Photos are compressed in the browser before upload or offline saving, with a maximum output edge of 1600 pixels and quality 82%. PNG/WebP transparency is preserved. A smaller original is retained instead of increasing file size. Photo inputs may be up to 30 MB; stored attachments must be under 10 MB. PDFs are unchanged. Existing stored photos are not recompressed. No SQL update is required.

The production sign-in form offers Remember me on this device. PHP uses an HttpOnly, Secure, SameSite=Lax cookie. Remembered logins last up to 90 days; ordinary sessions use a browser-session cookie with a 24-hour server expiry. Passwords are not saved in browser storage. See the cPanel README for hosting maintenance and authentication details.
