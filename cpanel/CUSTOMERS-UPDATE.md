# Customer creation and editing

The Customers page has a **+ New Customer** action. Select a customer row, then
choose **Edit customer** to change their name, contact person, phone, email,
address/default location, or notes. Customers can exist before their first report
or contract and appear in the customer name suggestions.

## Upload

Extract `dist/fieldnote-customer-management.zip` into
`/home/valsyste/fieldnote.valsystech.com.sg`, replacing the existing public files.
The seven files belong directly in that website root:

- `index.html`
- `api.php`
- `customer-records.php`
- `cpanel-adapter.js`
- `maintenance-ui.js`
- `customers-ui.js`
- `customer-suggestions.js`

Upload all seven together, then reload the website. The HTML versions the changed
scripts so browsers request the new copies. No SQL migration or private
configuration changes are required.

## Storage and history

Customer profiles use the existing `fn_records` table with kind `customer`.
Existing customers are still discovered from report and contract history; editing
one creates a profile. Previous names remain aliases connecting that history to
the renamed profile. Historical reports and contracts retain the names, contacts,
locations, and attachments recorded at the time. New report and contract saves
resolve the profile ID on the server.

The authenticated customer endpoint validates input, rejects duplicate names and
stale edits, and serializes profile updates with a database lock. Profile IDs,
aliases, revisions, and audit values are controlled by the server.

## Checks

- PHP 8.4 syntax checks and isolated customer storage tests cover creation,
  editing, validation, duplicates, rename history, stale edits, and rollback.
- JavaScript tests cover customer grouping, suggestions, and API routing.
- Browser tests with synthetic records cover creation, reload persistence,
  editing, legacy rename history, duplicate errors, unavailable customer data,
  and layouts at 320, 375, 390, 430, 768, 1024, and 1440 pixels.

The local tests do not connect to production MySQL. After upload, verify the live
Customers page, New Customer form, and Edit customer form. Verify a production
save using an intended real customer supplied by the owner; do not create test
customers or modify existing customer records merely for verification.
