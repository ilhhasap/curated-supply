import { createFileRoute, notFound } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { ProductGrid } from "@/components/product-card";
import { getBrand } from "@/lib/held/api";

export const Route = createFileRoute("/brands/$slug")({
  loader: async ({ params }) => {
    const brand = await getBrand({ data: params.slug });
    if (!brand) throw notFound();
    return brand;
  },
  component: BrandPage,
});

function BrandPage() {
  const brand = Route.useLoaderData();
  return (
    <Frame mark="brand">
      <header className="mb-8">
        <h1 className="text-3xl">{brand.name}</h1>
        {brand.official_domain ? (
          <p className="mt-2 font-mono text-sm text-quiet">{brand.official_domain}</p>
        ) : null}
      </header>
      <ProductGrid items={brand.items} />
    </Frame>
  );
}
