# Fieldnote project instructions

The owner requests that every completed webpage change be committed and pushed to this repository. Run relevant tests, inspect the diff, commit and push when access is available. Report the commit and any blockers; never claim an upload without verification. Do not force push.

The live website is https://fieldnote.valsystech.com.sg/ using cPanel PHP 8.4 and MySQL. Use `cpanel/` for the production source. The older `cloudflare/` and `supabase/` directories are legacy sources; do not treat them as the current deployment target. GitHub synchronization and live deployment are separate actions.

Website root: `/home/valsyste/fieldnote.valsystech.com.sg`. Private configuration and attachments: `/home/valsyste/fieldnote-private`. MySQL database and username: `valsyste_fieldnote`.

Owner handoff: migration from Supabase was completed and tested with 5 contracts, 13 reports, and 10 stored attachment files, including 9 referenced attachments. These are migration baseline counts, not a claim about current live totals.

Commit and push every completed change to https://github.com/joohock86/Fieldnote. Run relevant checks and inspect the diff before committing. Never commit private configuration, backups, customer uploads, or passwords.

Never commit runtime records, customer uploads, passwords, secret keys, local .env files, or generated ZIPs. Supabase publishable keys are browser-safe. Use example emails for team membership scripts.
