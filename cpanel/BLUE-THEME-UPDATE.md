# Blue theme and mobile layout update

This update changes the production interface in `cpanel/public/` to blue and improves navigation, form sizing, touch controls, long record text, and table scrolling on small screens. Completed/overdue/due status badges retain their distinct status colors.

## Upload through cPanel File Manager

1. Keep a private backup of the existing live `index.html` outside the repository.
2. Upload `index.html` and `responsive.css` from `cpanel/public/` into `/home/valsyste/fieldnote.valsystech.com.sg/`, replacing the existing `index.html`. Both files must be in the same folder. Alternatively, upload and extract the prepared update ZIP directly into that folder; its files are at the archive root.
3. Refresh the website. If it still looks green, reload while bypassing the browser cache.
4. Sign in and check Service reports, Customers, Maintenance contracts, Scheduled visits, and report/contract forms on your phone. Swipe wide tables sideways to see all columns.

The update package contains only these two public interface files. No SQL import, database change, private configuration, attachments, or migration files are needed. Existing API and attachment files remain in place.

## Verification

Local Chromium browser checks use synthetic records at widths of 320, 375, 390, 430, 768, 1024, and 1440 pixels. They cover sign-in, service reports, customer history, contracts, scheduled visits, details, and forms; check for page/dialog horizontal overflow; and check mobile form text is at least 16px. The checks do not contact production or write live records. Relevant adapter, scheduling, and photo compression checks are also run.

Run `node tests/cpanel-layout.cjs` with Playwright available on `NODE_PATH` and Microsoft Edge installed, or set `FIELDNOTE_BROWSER` to a compatible Chromium executable. Screenshots are generated under ignored `dist/layout-check/`.

Browser viewport checks are not a substitute for a physical iPhone/Android check after upload. The live sign-in page was inspected separately; authenticated screens were verified locally using the production source with synthetic API responses.
