# Customer creation and editing

The Customers page has a **+ New Customer** action. Select a customer row, then
choose **Edit customer** to change their name, contact person, phone, email,
address/default location, or notes. Customers can exist before their first report
or contract and appear in the customer name suggestions.

Customer profile forms do not show a customer-name suggestion dropdown. The
existing name remains editable. Suggestions are available when selecting a
customer in service report and maintenance contract forms.

**Cancel** closes new and editing forms for customers, service reports, and
maintenance contracts without saving changes.

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
  Cancel in all six new/editing forms, no suggestions in customer profile forms,
  and layouts at 320, 375, 390, 430, 768, 1024, and 1440 pixels.

The local tests do not connect to production MySQL. After upload, verify the live
Customers page, New Customer form, and Edit customer form. Verify a production
save using an intended real customer supplied by the owner; do not create test
customers or modify existing customer records merely for verification.

## Live verification — 13 October 2026

The owner uploaded the customer management update and follow-up fixes through
cPanel File Manager. Authenticated live browser checks confirmed:

- **+ New Customer** replaces **New service report** on the Customers page.
- New Customer and Edit customer forms load, with existing information populated
  when editing.
- Cancel closes all six new/editing forms for reports, contracts, and customers.
- Edit customer opens without the name suggestion dropdown; suggestions still
  work in service reports and maintenance contracts.
- No browser console errors were observed during these checks.

No live customer records were created or edited for verification. Save and reload
behavior was tested locally with synthetic storage/API responses, not against
production MySQL.

Implementation commits: `0cddeed` (customer management), `161321a` (customer
Cancel), `5f8f47f` (shared Cancel fix), and `4a31a9b` (customer form suggestions).
