import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { formatCardPrice } from "@/lib/held/format";
import type { Card } from "@/lib/held/types";

export function ProductCard({ product, showNote = false }: { product: Card; showNote?: boolean }) {
  const meta = [product.credit.bio, product.credit.city].filter(Boolean).join(" · ");
  return (
    <article data-annotate={`card:${product.slug}`} className="flex flex-col gap-2">
      <Link
        to="/products/$slug"
        params={{ slug: product.slug }}
        aria-label={product.name}
        className="block bg-photo"
      >
        <img src={product.photo} alt="" className="aspect-square w-full object-contain" />
      </Link>
      <div className="min-h-4">{product.official ? <Badge>Official</Badge> : null}</div>
      <Link to="/products/$slug" params={{ slug: product.slug }} className="leading-snug hover:underline">
        {product.name}
      </Link>
      <div className="flex items-baseline justify-between gap-3 font-mono text-xs text-quiet">
        <Link to="/brands/$slug" params={{ slug: product.brandSlug }} className="truncate hover:underline">
          {product.brandName}
        </Link>
        <span className="shrink-0 tabular-nums">{formatCardPrice(product.price)}</span>
      </div>
      {showNote ? (
        <p className="line-clamp-2 text-sm text-quiet">{product.note}</p>
      ) : (
        <div className="text-sm">
          <p>
            <span aria-hidden="true">● </span>
            <Link
              to="/people/$handle"
              params={{ handle: product.credit.handle }}
              className="hover:underline"
            >
              {product.credit.name}
            </Link>
            {product.extraHolders > 0 ? (
              <>
                {" "}
                <Link
                  to="/products/$slug"
                  params={{ slug: product.slug }}
                  hash="held-by"
                  className="font-mono text-xs text-quiet hover:underline"
                >
                  + {product.extraHolders}
                </Link>
              </>
            ) : null}
          </p>
          {meta ? <p className="text-quiet">{meta}</p> : null}
        </div>
      )}
    </article>
  );
}

export function ProductGrid({ items, showNote = false }: { items: Card[]; showNote?: boolean }) {
  if (!items.length) return <p className="text-quiet">Nothing live here.</p>;
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
      {items.map((item) => (
        <li key={item.slug}>
          <ProductCard product={item} showNote={showNote} />
        </li>
      ))}
    </ul>
  );
}
