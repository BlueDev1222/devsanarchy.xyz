# Dupe Event purchase goal

**Current setup uses direct webhooks**, since neither Tebex goal module is available. Follow [tracker/README.md](tracker/README.md). The website is configured for webhook mode and will remain in the connecting state until its deployed tracker URL is supplied. The module-based alternatives below are retained only for stores where those features are available.

## Alternative when Community Goals are unavailable

Use Webstore → Sidebar → Add Module → **Payment Goal** instead. Set the header to **Unlock the Dupe Event**, target to **50**, and enable amount display. Choose the revenue period deliberately: this module counts that period's revenue and resets daily, weekly, or monthly. It is not a permanent campaign total. Do not create both goal types with the same header; ambiguous matches are rejected.

The website supports either module using the same configuration. If neither module is available, verified purchase webhooks and a persistent backend are required; the public token alone cannot provide a complete historical purchase ledger.

The homepage reads Tebex's Community Goal total through the public Headless sidebar API. No private keys, webhook server, customer records, or payment processing are added to this repository.

## Connect the store

1. In Tebex, open Engagement → Community Goals. Create a non-repeatable goal with target 50, in a USD store, and select every package that should count. Do not add commands or a sale unless desired separately.
2. In Webstore → Sidebar, add a Community Goal module linked to that goal. Set its header to exactly **Unlock the Dupe Event** and enable **Display Goal Amount**. Keep it visible throughout the campaign.
3. Obtain the store's **public** Headless API token from Tebex's developer settings. Put only this public token in assets/goal-config.json. Never use a private token or plugin secret.
4. Publish the changed configuration. Check the website shows the same total as the Tebex module. A confirmed zero displays **$0 raised of $50**.

The page polls every 60 seconds while visible and refreshes when visitors return to the tab. Tebex processing/cache delays may add latency. Totals reflect Tebex's goal accounting; manual payments do not count. Existing sales, refunds, and eligible packages follow Tebex's own goal rules. Do not use a repeatable goal, which can reset after completion.

Until connected, the page shows an unknown total rather than claiming no money has been raised. Failed refreshes retain the last confirmed total and mark it delayed. Missing/duplicate modules, hidden amounts, negative/non-numeric amounts, or a target other than 50 are rejected.

This goal is shown alongside the existing event countdown. Reaching $50 does not change the event time or run server commands.

Sources:
- https://docs.tebex.io/creators/tebex-control-panel/engagement/community-goals
- https://docs.tebex.io/developers/headless-api/guides/sidebar/get-sidebar-modules
