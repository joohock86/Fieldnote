# Customer name suggestions

The customer name field in service report and maintenance contract forms suggests existing names as you type. It uses saved customer profiles and customers discovered from the reports and contracts already loaded for the signed-in user. This includes customers with no service history yet. It matches partial names without regard to case, removes duplicate suggestions, and allows new names. Selecting a suggestion fills only the customer name; other details remain editable and are not filled automatically.

New Customer and Edit customer profile forms do not display this dropdown. Their customer name is a regular editable text field.

Tap or click a suggestion, or use the Up/Down arrows followed by Enter. Escape dismisses the suggestions without closing the form. No reports or contracts are saved by selecting a suggestion.

## cPanel update

The original suggestions-only package contained `index.html`, `responsive.css`, and `customer-suggestions.js`. For the current customer management installation, follow [CUSTOMERS-UPDATE.md](CUSTOMERS-UPDATE.md) and use the current production source in `cpanel/public/`; old update ZIPs may replace newer behavior. The page uses versioned stylesheet and script links so browsers request updated files.

This update needs no SQL changes or private configuration. It contains no customer records or attachments.

## Verification

`node tests/customer-suggestions.cjs` checks partial matching, result ordering, case and spacing deduplication, accents, empty input, and new names. `node tests/cpanel-layout.cjs`, with Playwright on `NODE_PATH` and Edge installed, checks both forms at 320–1440px, including taps, keyboard selection, contract-only customer names, Escape, custom names, and ensuring suggestion selection does not write records.

On 13 October 2026, after the owner uploaded commit `4a31a9b`, live browser checks confirmed Edit customer opens without suggestions and typing a partial customer name still produces suggestions in both service report and contract forms. These checks did not save or change live records.
