import { createFileRoute, Link } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { ProductGrid } from "@/components/product-card";
import { listProducts } from "@/lib/held/api";
import { CATEGORIES, type SortKey } from "@/lib/held/types";

type Search = { category: string; sort: SortKey };

export const Route = createFileRoute("/products/")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    category: typeof search.category === "string" ? search.category : "all",
    sort: search.sort === "newest" || search.sort === "price" ? search.sort : "featured",
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listProducts({ data: deps }),
  component: ProductsPage,
});

const SORTS: { id: SortKey; label: string }[] = [
  { id: "featured", label: "Featured" },
  { id: "newest", label: "Newest" },
  { id: "price", label: "Price" },
];

function ProductsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const filters = [
    { id: "all", label: "All", count: data.total },
    ...CATEGORIES.map((category) => ({
      id: category,
      label: category,
      count: data.counts[category] ?? 0,
    })),
  ];
  return (
    <Frame mark="products">
      <h1 className="mb-6 text-3xl">Products</h1>
      <div data-annotate="filters" className="mb-8 flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
        <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-sm">
          {filters.map((filter) => {
            const on = search.category === filter.id;
            return (
              <Link
                key={filter.id}
                to="/products"
                search={{ category: filter.id, sort: search.sort }}
                className={`py-1 hover:underline ${on ? "underline" : "text-quiet"}`}
              >
                {filter.label} <span className="tabular-nums">{filter.count}</span>
              </Link>
            );
          })}
        </div>
        <div className="flex gap-4 font-mono text-sm">
          {SORTS.map((sort) => (
            <Link
              key={sort.id}
              to="/products"
              search={{ category: search.category, sort: sort.id }}
              className={`py-1 hover:underline ${search.sort === sort.id ? "underline" : "text-quiet"}`}
            >
              {sort.label}
            </Link>
          ))}
        </div>
      </div>
      <ProductGrid items={data.items} />
    </Frame>
  );
}
