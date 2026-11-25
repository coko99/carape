# QA

Checked locally on 3 November 2026 against `npm run dev` and the PGlite database.

## Passed

- Homepage in Serbian and English shows the six real ranges and the four featured products with published prices (140, 150, 120 and 170 RSD).
- Product page for Crna sa jezičkom i silikonom shows sizes 39-42 and 43-46, the shared price, the Serbian description, and the note that the quantity was not published.
- Add to bag, cart quantity, and cash-on-delivery checkout created order `ZJ-2026-1001`. The confirmation says it is not a fiscal receipt and that delivery is still unpriced.
- After the order, the bag is empty.
- Admin owner login showed 1 order today, gross 140.00 RSD, net 0.00 RSD because the payment is unpaid. The formula is on the dashboard. No conversion rate is shown.
- The same order was moved from `placed` to `confirmed`.
- Sale page has no invented discounts. Rechecked after a local database rebuild: `/snizenje` returns 200 and says there are 0 products.
- `npm test` covers pricing, coupons, unpublished stock, oversell blocking, order transitions, roles and the net-sales formula. 9 passed after the money formatter change.

The local PGlite file aborted during development and was replaced. Catalog and the owner account were seeded again. The earlier test order lives only in `.data/pglite-broken`, not in the current shop database.

## Still open

- Resend is not configured, so order mail is stored in `email_outbox`, not delivered.
- Shipping, bank account, PIB and tax are unset.
- Numeric stock is unset for all 539 variants.
- Admin still needs category editing, coupons, customer export, inquiry inbox, newsletter list, CMS editing, and CSV/XLSX financial export.
- Password reset page exists at `/reset-lozinke`. The email link is not sent until Resend is configured.
- Two product images have no local WebP because the original file was missing.
- Playwright is not set up. The shopping path above was exercised in the browser.
