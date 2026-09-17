# Operations runbook

## Deployment target

The application builds as a Node server through `@sveltejs/adapter-node`. Run the generated server behind HTTPS so production session cookies remain secure. `/api/health` is the liveness endpoint; `/api/ready` verifies database connectivity.

Required environment variables are `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, and `LLM_API_KEY`. `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_MAX_CONCURRENCY` (default `4`) are optional. Rate limits and LLM concurrency slots are stored in the shared database, so every Node instance enforces the same counters. `AGENT_API_KEY` is an optional break-glass administrator credential; normal agents use project-scoped tokens created from the Implementasi page.

## Forward migration

1. Back up the hosted database and restore it to staging.
2. For a new empty database, run `npm run db:migrate`; all versioned files in `app/drizzle/` create the complete schema in order.
3. For a legacy database that predates migration history, apply `app/migrations/legacy-v1-to-v2.sql` once to the staging copy. Do not run the Drizzle baseline against that database.
4. Verify row counts for `perencanaan`, `fitur`, `sub_fitur`, and `kanban_task` before and after migration.
5. Run registration, login, plan generation, task generation, token creation, agent claim/completion, and PRD reopen checks on staging.
6. Apply the matching path to production once, then deploy the application build.
7. Treat legacy projects with `user_id IS NULL` as quarantined. Assign them only through an audited ownership recovery process.

Both paths preserve existing rows. The legacy script only adds nullable columns, indexes, and new tables. Record its application in the deployment log; its `ALTER TABLE` statements intentionally fail on accidental replay so a partial or repeated run is visible.

## Rollback

Application rollback is compatible with the added nullable columns and new tables. Roll back the Node artifact while leaving the expanded schema in place. Do not drop columns or tables during an incident. After traffic is stable, investigate and ship a forward fix. Restore the database backup only if independent verification proves data corruption.

Project tokens can be revoked from the Implementasi page. If the optional administrator key is exposed, rotate `AGENT_API_KEY` in the deployment environment and restart every application instance.

## Verification commands

```bash
cd app
npm ci
npm run lint
npm run check
npm run build
npm test

cd ../cli
npm ci
npm test
node bin/cli.js --help
```
