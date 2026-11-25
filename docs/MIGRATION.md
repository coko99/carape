# Migration inventory

Source: public pages and `https://proizvodnjacarapa.com/wp-json/wc/store/v1/`. The authenticated WooCommerce API (`wc/v3`) returned 401, so unpublished stock, cost prices and private wholesale prices were not available. Nothing was invented to fill those fields.

Secondary site `https://www.zajo.co.rs/Carape` shows family article codes such as Art.8952. Those codes were not matched to WooCommerce products and are not stored as SKUs.

## Verified and imported

| Item | Count | Notes |
| --- | --- | --- |
| Categories | 31 | Hierarchy kept. Roots: muški, ženski pamučni, dečiji, bebe, sportski, medicinski, najtraženiji. |
| Products | 199 | All variable. Display names can repeat; slugs differ. |
| Size variants | 539 | One published price copied onto every listed size. Size options came from the product page select. |
| Prices | 199 | Minor units already, 90.00 to 850.00 RSD. No sale prices. `onSale` is false for every product. |
| Photographs | 200 WebP | Originals reused with the client's authorization. Two source files were missing and those images fall back to the old URL. |
| Company facts | — | ŽA-JO KOMERC d.o.o., founded 1992, Stevana Sinđelića 21/3, 37000 Kruševac, proizvodnjacarapa@gmail.com, Nevena Prokić +381 69 210 1986, Žarko Sić +381 63 119 2964. |

Availability is the published `is_in_stock` flag. `stockQuantity` is null and `stockState` is `not_published`. Checkout records `unverified_sale` and does not decrement a number that was never published. When an admin later enters a quantity, checkout reserves it with a conditional update.

Featured products are the ones in `najtrazeniji-proizvodi` or named on the old homepage. That is not a sales ranking from this shop. `isNew` is false until an editor sets it. The sale page is empty on purpose.

English category labels are interface translations. Product descriptions stay in the original Serbian, with a note on `/en`.

## Not migrated

- SKU / article code: none were published. Template: `public/templates/stock-import-template.csv` (539 rows, sku and stock left blank).
- Numeric stock, low-stock threshold, material and washing as structured fields. Composition that appears inside a description is left in the description.
- Tax rate. Prices are the displayed retail price. Tax is not split out.
- Shipping price, free-delivery threshold, minimum order.
- PIB, matični broj, bank account.
- Reviews. The store API reported zero reviews. Homepage testimonials were not copied.
- Blog, privacy sample and returns sample. The WordPress site contains casino and gambling spam in pages, hidden link blocks and posts. That content was not imported and those URLs are not redirected.
- zajo.co.rs article codes.

## Old site

The live WordPress installation is compromised. Clean or take it down before any redirect from the old domain. Product and category URLs that were real are redirected in `next.config.ts`. Spam blog URLs are not.

## Traceability

Each product and category keeps `sourceUrl` and `sourceId`. Local ids are `src-product-{id}`, `src-category-{id}` and `src-variant-{id}-{size}`.
