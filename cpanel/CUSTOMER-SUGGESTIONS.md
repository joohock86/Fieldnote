# Customer name suggestions

The customer name field in service report and maintenance contract forms now suggests existing names as you type. It uses the reports and contracts already loaded for the signed-in user, matches partial names without regard to case, removes duplicate suggestions, and allows new names. Selecting a suggestion fills only the customer name; other details remain editable and are not filled automatically.

Tap or click a suggestion, or use the Up/Down arrows followed by Enter. Escape dismisses the suggestions without closing the form. No reports or contracts are saved by selecting a suggestion.

## cPanel update

Upload and extract `dist/fieldnote-customer-suggestions.zip` into `/home/valsyste/fieldnote.valsystech.com.sg/`. The archive contains `index.html`, `responsive.css`, and `customer-suggestions.js` at its root. Replace the existing public files and refresh the website. The page uses versioned stylesheet and script links so browsers request the updated files.

This update needs no SQL changes or private configuration. It contains no customer records or attachments.

## Verification

`node tests/customer-suggestions.cjs` checks partial matching, result ordering, case and spacing deduplication, accents, empty input, and new names. `node tests/cpanel-layout.cjs`, with Playwright on `NODE_PATH` and Edge installed, checks both forms at 320–1440px, including taps, keyboard selection, contract-only customer names, Escape, custom names, and ensuring suggestion selection does not write records.
