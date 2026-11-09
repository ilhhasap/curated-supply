# Held

A quiet editorial directory of original products that real people use. Not a store. Every product card credits the person who uses it. Outbound links go only to an official brand or official store.

## Visual language

Reference for the browse surface: curated.supply/browse.

- Canvas `#f2f2f2`, cards `#ffffff`, ink `#141414`, metadata `#8d8d8d`, hairline `#e4e4e4`.
- Cards use a large radius (`1.25rem`). No shadows, no gradients, no colorful pills.
- One typeface: Geist Variable, including labels, prices, and counts. No monospace.
- Text-only navigation. The mark is a small asterisk. Active nav is a white pill.
- Product photos are square, object on white, centered in the card.
- Hover is an underline on the name, not a lifted card.
- One badge only: Official. It appears only when the domain is on the allowlist, never because a user typed it.

## Navigation

For you · Browse · Brands · Lists · People

More, from the menu: Categories, Submit, My kit. Editors also see Admin.

## Pages

- For you (`/for-you`): the full catalog, category filters, sort Featured / Newest / Price, show more.
- Browse (`/`): By category, By brand, By list, By product. Each section has a count and See all.
- Products, brands, categories, people, lists: text indexes and detail pages. Credits are links.
- Submit: search what you use, then hold an existing product or introduce a new one. Unknown domains go in review. Marketplace hosts are rejected.
- My kit (`/me`): live, in review, and needs edit. The owner can edit or remove their own note.
- Admin (`/admin`): editors only. Overview, queue, sent back, featured, allowlist. Approving can add the host to the allowlist.
- Review (`/review`): the earlier queue. The header now points at Admin.

## Data

- Person, brand, product, use, list, allowlist.
- Product status: `in_review`, `live`, `needs_edit`.
- Prices are integer IDR snapshots with a date. Not a checkout.
- The For you catalog is a static export in `src/lib/held/for-you-catalog.json`. Images are hotlinked.
- Seed: four people, a desk kit, about a dozen products on allowlisted domains, one list called Desk, plus one in-review and one needs-edit item on the signed-in demo kit.

## Comment layer

The Comment control is a temporary v1 note tool. Notes stay in the browser (`held-v1-notes`). It is not part of the product.

## Out of scope

Follow, likes, newsletter, multiple photos, used goods, condition, user-editable prices, email notifications, user-created lists, seller accounts, UI translation, currencies other than IDR.

## Run

```bash
npm install
npm run dev
```

The app is TanStack Start, Tailwind v4, PGLite locally, email-and-password auth. The first signed-in person is the editor.
