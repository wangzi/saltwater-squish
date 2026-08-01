# Saltwater Squish Ecommerce Prototype

A Vite + React storefront prototype for the Saltwater Squish coastal squishy shop.

## Run

```bash
npm install
npm run dev
```

Local URL:

```text
http://127.0.0.1:5173/
```

## Checks

```bash
npm run lint
npm run build
```

## What Is Included

- Beach/ocean art direction with generated local bitmap assets
- Ambient foam bubbles, click splashes, and add-to-cart flight animation
- Squish Splash Studio canvas inspired by Splash Canvas, adapted for texture discovery
- Product grid with search and feel filters
- Cart drawer with quantity controls
- Bundle section and five short drop-film concepts
- Reduced-motion fallback for decorative animation

## Key Files

- `src/App.tsx`: storefront data, cart behavior, filters, and interactions
- `src/App.css`: responsive layout, art direction, and animation styles
- `src/assets/storefront/`: generated hero and product catalog imagery
- `DESIGN_PLAN.md`: ecommerce IA, naming, launch, and Shopify handoff notes

## Shopify Handoff

The storefront matches Shopify variants to the stable `SWS-*` SKUs in `src/productCatalog.ts`.
When Shopify is configured, prices and availability come from Shopify and checkout uses a
Shopify Cart `checkoutUrl`.

Set these locally or in Vercel:

```bash
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_API_VERSION=2026-07
SHOPIFY_STOREFRONT_PRIVATE_TOKEN=your-private-headless-token
SHOPIFY_WEBHOOK_SECRET=your-webhook-signing-secret
```

The private token is optional for Shopify's tokenless product and cart fields, but recommended
for authenticated server-side Storefront API requests. Never expose it through a `VITE_*`
environment variable.

## Shopify Inventory Webhook

The `POST /api/shopify/inventory-levels-update` endpoint handles Shopify's
`inventory_levels/update` webhook. It looks up the changed inventory item through the Shopify
Admin API, totals its available quantity across locations, matches its SKU to a product
manifest, and writes that absolute quantity to Vercel Blob. This covers inventory changes made
in Shopify Admin as well as purchases, returns, and cancellations. Processed webhook IDs are
recorded in Vercel Blob so Shopify retries do not repeat the write.

Create an app in the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard/). Under
**Versions**, create and release a version with the `read_inventory` Admin API scope, then
install the app on the store. Copy the app's **Client ID** and **Secret** from its **Settings**
page into `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` in Vercel. The webhook exchanges these
credentials for a short-lived Admin API token and refreshes it automatically.

Then configure one store-level webhook in
**Shopify Admin → Settings → Notifications → Webhooks**:

- Event: **Inventory level update**
- Format: **JSON**
- URL: `https://saltwatersquish.com/api/shopify/inventory-levels-update`
- API version: the same stable version used by the app

Copy the signing secret shown on that Shopify Webhooks page into
`SHOPIFY_WEBHOOK_SECRET` in the Vercel project for every deployed environment that receives the
webhook, then redeploy. App-managed webhooks can use `SHOPIFY_APP_CLIENT_SECRET` instead. Keep
product SKUs identical in Shopify and the product catalog; inventory items without a matching
SKU are reported as skipped.

Remove the old **Order payment** and **Order cancellation** webhook subscriptions after the
inventory-level webhook is active. Their endpoints remain available as a fallback, but they
apply quantity deltas and must not run alongside the absolute inventory-level sync or stock can
be adjusted twice.
