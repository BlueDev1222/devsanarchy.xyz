# Direct Tebex purchase tracker — no goal modules needed

This separate Cloudflare Worker receives signed Tebex webhooks and stores a minimal event ledger in D1. The GitHub Pages website polls its public /goal endpoint. It is not deployed yet.

## Setup

Requires access to Cloudflare Workers/D1 and Tebex Developers → Webhooks.

1. From this directory, use the official Cloudflare Wrangler CLI to sign in (`npx wrangler login`).
2. Create the database: `npx wrangler d1 create devs-anarchy-goal`. Put the returned database ID in wrangler.jsonc.
3. Set CAMPAIGN_START in wrangler.jsonc to the agreed start timestamp, e.g. an activation time in ISO UTC. It is deliberately unset rather than silently counting historical sales.
4. Apply the schema: `npx wrangler d1 execute devs-anarchy-goal --remote --file schema.sql`.
5. Save the Tebex webhook signing secret with `npx wrangler secret put TEBEX_WEBHOOK_SECRET` (or Cloudflare's encrypted Secrets interface). Never commit it or put it in the website configuration.
6. Deploy using `npx wrangler deploy`.
7. In Tebex Developers → Webhooks, add the deployed URL with /webhook. Subscribe to payment.completed, payment.refunded, and all four payment.dispute events. Validate the endpoint.
8. Put the deployed HTTPS /goal URL in assets/goal-config.json endpoint. Publish the website through the PR.
9. Confirm /goal returns a valid USD total. Use Tebex's Send Test with a real transaction to verify receipt and replay safety. Test signatures alone must not be mistaken for proof of a real purchase.

## Accounting and limits

- Counts the signed payment's USD `price.amount` once per transaction, for purchases created on or after CAMPAIGN_START. This is a gross payment measure, not a promise of net proceeds after fees/taxes.
- Other currencies return 422 for review; no invented exchange-rate conversions.
- Refunds exclude the whole transaction, conservatively including partial refunds. Open/lost disputes are excluded; won disputes restore the original completion amount. Closed disputes restore only when Tebex marks the payment complete.
- Completion and refund deliveries may arrive out of order. Event IDs are deduplicated; totals are grouped by transaction, so replayed completions don't add money twice. Refunds remain excluded.
- Tebex must send completion notifications for every counted transaction. Historic sales are not automatically imported. A replay of an eligible real transaction may be used to backfill it.
- The total never resets monthly. Changing CAMPAIGN_START changes which purchases count; the event ledger is retained.
- /goal returns only the total, target, currency, and campaign start. It returns 503 before successful Tebex validation. No customer identity, raw request body, private secret, or original transaction ID is saved. Transaction identifiers are hashed.
- Availability depends on webhook delivery. Monitor failed deliveries in Tebex; a validation proves connectivity at that time, not ongoing delivery health.
- Schema tests run against real SQLite with a D1 adapter. They do not replace deployment and live Tebex verification.

## Checks

`node --test tracker/worker.test.mjs goal.test.mjs` from the site directory (Node 24).

Sources: https://docs.tebex.io/developers/webhooks/overview and https://developers.cloudflare.com/d1/worker-api/prepared-statements/.
