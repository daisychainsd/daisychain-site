# Order recovery update — September 22, 2026

See [ORDER-RECOVERY-2026-09-22.md](ORDER-RECOVERY-2026-09-22.md) for the physical-order incident, required database setup and activation sequence. All physical website payments now use Ops persistence independently of the catalog flag; the database migration must precede deployment. Older shipping history must be reconciled manually against Pirate Ship. Tracking is optional when marking shipped. The original catalog/inventory cutover below remains a separate unfinished project.

# Merch Ops: rollout and daily use

## Before activation

The code is complete behind `MERCH_BACKEND=supabase`. Without the flag, the existing Shopify storefront remains active. Supabase and several other services are shared with production: do not treat `dev` as a disposable test environment.

1. Review the final Claude report and complete local checks: `npm run test:merch`, TypeScript, changed-file lint, and `npm run build`. `npm run build -- --webpack` is a supported fallback if the environment blocks Turbopack's CSS worker port.
2. Run **only** `scripts/merch-schema-2026-09-14.sql` in the existing Supabase SQL editor, then `scripts/merch-storage-2026-09-14.sql`. They create new tables/functions and the public product-image bucket. Never apply the full `supabase-schema.sql` to an existing database. The schema file is intended to run once, transactionally.
3. Review `.merch-import/catalog.json` and its downloaded images, generated with `node --env-file=.env.local scripts/merch-import.mjs`. The dry run performs reads only. It paginates products and refuses to truncate a product with over 100 variants/images. Variant IDs, handles and original variant ordering are preserved.
4. Run `node --env-file=.env.local scripts/merch-import.mjs --apply` to copy the reviewed images into the `merch-images` bucket and upsert the catalog. It verifies local image hashes and public image access. Existing stock counts are never overwritten by a repeated import; new variants start at zero. Do not rerun an old import after making product edits in Ops because it would overwrite that content.
5. Deploy the reviewed code to the `dev` branch preview, with the backend flag initially unset. Open `/ops/merch`; count current physical stock and enter opening adjustments for each variant. Keep import/count time close to cutover so intervening booth/online sales can be reconciled. Archive Shopify order history separately before cancellation.
6. Enable `MERCH_BACKEND=supabase` for the preview and rebuild. Verify real catalog pages/images and release-linked products with read-only browsing. Validate purchases only against an isolated Supabase test project with test Stripe keys and outbound email/newsletter disabled. The fixture browser checks do not certify a live Stripe account's settings.
7. Confirm the Stripe endpoint subscribes to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`, and `charge.dispute.created`. Do not remove events needed by digital purchases. Ensure a live webhook reaches the production backend and test webhooks reach the isolated test backend.
8. Production still follows `CLAUDE.md`: explicit go-live instruction, PR from `dev` to `main`, correct production flag, and a monitored first real order. Reconcile any Stripe sessions still in flight from the old backend. Their captured product name/size must match the imported catalog; ambiguous or renamed variants require manual reconciliation before retrying the webhook. Keep names and sizes unchanged during cutover. Do not cancel Shopify until product images, stock, order receipt and Pirate Ship label creation have been verified.

## Daily workflow

- **Online orders:** `/ops/merch` → Orders → New. Open an order to see items, address and payment information. Refresh explicitly to fetch newer orders.
- **Shipping:** select new paid orders → Export CSV → import directly into Pirate Ship. Map Name, Email, Phone and the separate address columns (phone is blank when checkout did not collect it); keep ZIP as text if opening the CSV in a spreadsheet. Choose a saved package or enter weight/dimensions. International customs details are entered in Pirate Ship. Enable Pirate Ship's shipment emails when purchasing labels.
- **After labels:** save tracking and set Shipped in Ops. Downloading a CSV only marks Exported. Use Re-export selected for an intentional replacement CSV, such as a failed download; avoid buying the same label twice.
- **Held orders:** investigate refunds, disputes or stock shortages. Correct physical counts first. For a shortage, enter a resolution note and check Inventory issue resolved before setting New. Refunded/disputed orders cannot be released to shipping. A partial refund (for example shipping overcharge) can be explicitly released if its items should still ship.
- **Booth:** charge the manually calculated total in Stripe Dashboard Tap to Pay. In Ops → Inventory, select each variant, enter a negative quantity for the units sold and a reason including the show/date. This is not automatically linked to Tap to Pay. Enter returns/restocks as positive adjustments after counting the items.
- **Products:** use Products to edit names, descriptions, images, prices, SKUs and visibility, or add a product/variant. New variants begin at zero stock. Preserve existing handles if linked from Sanity releases. For complex multi-option variant additions, retain consistent option names/values.
- **Confirmation emails:** the order card indicates whether confirmation delivery was recorded. If Resend is unset, the order still persists and checkout confirms payment; fix email configuration and retry the Stripe event to send the confirmation.

## Rollback and limits

Unsetting the backend flag restores Shopify for new checkouts only. In-flight Supabase checkouts still persist to Supabase by metadata, including refunds/disputes. Keep both systems available while reconciling in-flight orders. Do not cancel Shopify before this rollback window closes.

V1 uses a stock check, not reservations; two buyers can pay for the last item concurrently. The second payment is retained with a visible inventory hold rather than lost. Staff must provide stock or issue a refund. Product image uploads support JPG/PNG/WebP up to 4 MB through Ops (the direct catalog importer supports 10 MB). Export batches contain at most 100 shipments. Staff share the existing Ops password; this is not a per-person permissions system. Success pages do not expose customer addresses or order details to bearer session links.

## Reference checks

- [Stripe Dashboard Tap to Pay](https://docs.stripe.com/no-code/in-person) supports taking in-person payments with the mobile app; availability depends on supported device/account/location.
- [Pirate Ship spreadsheet import](https://support.pirateship.com/en/articles/1068428-how-do-i-upload-address-spreadsheets-into-pirate-ship) maps column headings on the first upload. Validate the provided country codes with one label before bulk shipping.
- [Vercel function limits](https://vercel.com/docs/functions/limitations) informed the conservative 4 MB Ops image limit; the catalog importer uploads directly to Storage.
