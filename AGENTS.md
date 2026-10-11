# Fieldnote project instructions

The owner requests that every completed webpage change be committed and pushed to this repository. Run relevant tests, inspect the diff, commit and push when access is available. Report the commit and any blockers; never claim an upload without verification. Do not force push.

Use cloudflare/ for hosted source. After changes, rebuild the offline preview with python scripts/build-offline.py and the deployment ZIP with python scripts/package.py. Add SQL migrations in supabase/ when needed; do not alter previously applied migrations. Deployment and SQL execution are separate from GitHub synchronization.

Never commit runtime records, customer uploads, passwords, secret keys, local .env files, or generated ZIPs. Supabase publishable keys are browser-safe. Use example emails for team membership scripts.
