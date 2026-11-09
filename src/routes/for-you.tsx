import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Frame } from "@/components/shell";
import catalog from "@/lib/held/for-you-catalog.json";

type Item = {
  slug: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string;
  staff: boolean;
  at: number;
};

const ITEMS = catalog as Item[];

const CATEGORY_ORDER = [
  "Tech",
  "Workspace",
  "Home",
  "Carry",
  "Books",
  "Lifestyle",
  "Coffee",
  "Watches",
  "Personal",
  "Travel",
  "Cameras",
  "Vehicles",
] as const;

type SortKey = "featured" | "newest" | "price";
type Search = { category: string; sort: SortKey };

const PAGE = 32;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export const Route = createFileRoute("/for-you")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    category: typeof search.category === "string" ? search.category : "all",
    sort: search.sort === "newest" || search.sort === "price" ? search.sort : "featured",
  }),
  component: ForYouPage,
});

function ForYouPage() {
  const search = Route.useSearch();
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    setVisible(PAGE);
  }, [search.category, search.sort]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of ITEMS) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return map;
  }, []);

  const filters = [
    { id: "all", label: "All", count: ITEMS.length },
    ...CATEGORY_ORDER.filter((name) => counts.has(name)).map((name) => ({
      id: name,
      label: name,
      count: counts.get(name) ?? 0,
    })),
  ];

  const items = useMemo(() => {
    const list = ITEMS.filter((item) => search.category === "all" || item.category === search.category);
    if (search.sort === "newest") return [...list].sort((a, b) => b.at - a.at);
    if (search.sort === "price") return [...list].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    return list;
  }, [search.category, search.sort]);

  const shown = items.slice(0, visible);

  return (
    <Frame mark="for-you">
      <h1 className="text-4xl font-medium tracking-tight">For you</h1>
      <p className="mt-3 max-w-xl text-sm text-quiet">
        {ITEMS.length.toLocaleString("en-US")} products from Curated Supply. Prices are US dollar snapshots, not a checkout.
      </p>
      <div data-annotate="filters" className="mt-8 mb-8 flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-sm">
          {filters.map((filter) => {
            const on = search.category === filter.id;
            return (
              <Link
                key={filter.id}
                to="/for-you"
                search={{ category: filter.id, sort: search.sort }}
                className={`py-1 hover:underline ${on ? "underline" : "text-quiet"}`}
              >
                {filter.label} <span className="tabular-nums">{filter.count}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex gap-4 font-mono text-sm">
          {(
            [
              ["featured", "Featured"],
              ["newest", "Newest"],
              ["price", "Price"],
            ] as const
          ).map(([id, label]) => (
            <Link
              key={id}
              to="/for-you"
              search={{ category: search.category, sort: id }}
              className={`py-1 hover:underline ${search.sort === id ? "underline" : "text-quiet"}`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {shown.map((item) => (
          <li key={item.slug}>
            <article data-annotate={`card:${item.slug}`} className="flex h-full flex-col rounded-card bg-card">
              <div className="grid aspect-square place-items-center p-5">
                <img src={item.image} alt="" loading="lazy" className="max-h-full w-full object-contain" />
              </div>
              <div className="flex flex-1 flex-col px-4 pb-4">
                <p className="leading-snug">{item.name}</p>
                <p className="mt-1 flex items-baseline justify-between gap-3 font-mono text-xs text-quiet">
                  <span className="truncate">{item.brand || item.category}</span>
                  <span className="shrink-0 tabular-nums">{money.format(item.price)}</span>
                </p>
                <p className="mt-1 font-mono text-xs text-quiet">
                  {item.category}
                  {item.staff ? " · Staff pick" : ""}
                </p>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {visible < items.length ? (
        <div className="mt-10 text-center">
          <button type="button" className="text-sm hover:underline" onClick={() => setVisible((n) => n + PAGE)}>
            Show more
          </button>
          <p className="mt-2 font-mono text-xs text-quiet">
            {shown.length} of {items.length}
          </p>
        </div>
      ) : (
        <p className="mt-10 text-center font-mono text-xs text-quiet">{items.length} products</p>
      )}
    </Frame>
  );
}
