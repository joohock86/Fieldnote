# cPanel migration (PHP 8.4 + MySQL/MariaDB)

This separate version is prepared for https://fieldnote.valsystech.com.sg/. It has not been deployed or tested against the actual hosting/database. Keep the Supabase site and data intact until migration and manual checks pass.

Requirements: PHP 8.4 with PDO MySQL and fileinfo, MySQL 5.7+ or a compatible MariaDB with JSON support, HTTPS, and a writable private folder. PHP was not installed in the development workspace, so PHP runtime/database tests are still required on a staging installation.

## Stage the migration

1. Back up your existing cPanel website folder. In cPanel MySQL Databases, create a new database and dedicated database user, then grant that user privileges to that database. Import `schema.sql` through phpMyAdmin. Do not import it into an unrelated application's database.
2. In File Manager, create `/home/valsyste/fieldnote-private/` outside `public_html` and outside the subdomain document root. Copy `private/config.example.php` into it as `config.php`. Fill in the full cPanel-prefixed database name, database username and database password privately. Use a unique random setup key of at least 32 characters. Never send these secrets through chat or commit them to GitHub.
3. In `/home/valsyste/fieldnote.valsystech.com.sg/migration-preview/`, upload all files from `public/`. Copy `config-path.example.php` to `config-path.php` and set the absolute path to your private config. The private `files` folder is created during uploads. Its contents are accessible only through authenticated PHP requests.
4. Open `https://fieldnote.valsystech.com.sg/migration-preview/migration.html`. Step 1 signs into the current Supabase website account and creates a JSON export. Enter the browser-safe publishable key from the original config.js. The export includes reports, contracts, referenced attachments and accessible unreferenced storage files. It does not export Supabase passwords, sessions, or dashboard credentials. Customers remain grouped from existing reports/contracts as in the original webpage.
5. Save the export privately. At the final migration, pause edits by both users while exporting and importing. If a download is blocked, press Download completed export or try a desktop browser. Large photo libraries may exceed browser memory; if export fails, stop and arrange a server-assisted migration rather than discarding files.
6. On the migration page, use the private setup key to create the two cPanel users with new passwords (12+ characters). The first is the migration administrator. The old Supabase passwords are not migrated. Setup disables itself when the users exist.
7. Import the JSON as the first user. Files are copied first, then contracts, then reports. IDs, scheduled dates, original audit fields and attachment paths are preserved. Import retries of the same backup are supported against the staging database; conflicting existing files are rejected. Failed imports may leave a partial database—retry and verify before switching. This is a migration tool, not a normal backup restore/merge tool.
8. Confirm imported fields, attachment checksums, record counts and file counts match, with no missing files. Test both users' report history, contract schedules, photos, PDFs, photo compression and remembered login. Test that signed-out users cannot fetch attachments. PHP should log server errors privately; the webpage does not reveal credentials.
9. Only after checks pass, replace your live webpage files with the staged `public/` files, retaining the valid `config-path.php`. Remove `migration.html` and `migration.js` from the public site after migration. Keep Supabase and the export as a recovery source until you confirm the new site is stable.

PHP uses an HttpOnly, Secure, SameSite=Lax cookie. Remembered logins last up to 90 days; ordinary sessions use a browser-session cookie with a 24-hour server expiry. No passwords are stored in browser storage. PDF and photo files are stored outside the public root. Both users can edit reports and contracts; only the first user can run imports.

Back up the complete MySQL database AND the private files directory together. Remove expired sessions/rate-limit rows periodically as appropriate. This release does not include password reset email or automated hosting backups.

The scripts do not execute any Supabase deletion, database replacement, or live cutover. GitHub synchronization and cPanel deployment are separate steps.
