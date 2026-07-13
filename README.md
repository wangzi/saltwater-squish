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
```

The private token is optional for Shopify's tokenless product and cart fields, but recommended
for authenticated server-side Storefront API requests. Never expose it through a `VITE_*`
environment variable.
