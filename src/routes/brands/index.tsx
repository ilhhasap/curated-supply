import { createFileRoute, Link } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { TextIndex } from "@/components/text-index";
import { listBrands } from "@/lib/held/api";

export const Route = createFileRoute("/brands/")({
  loader: () => listBrands(),
  component: BrandsPage,
});

function BrandsPage() {
  const rows = Route.useLoaderData();
  return (
    <Frame mark="brands">
      <h1 className="mb-8 text-3xl">Brands</h1>
      <TextIndex
        rows={rows}
        name={(row) => (
          <Link to="/brands/$slug" params={{ slug: row.slug }} className="hover:underline">
            {row.name}
          </Link>
        )}
      />
    </Frame>
  );
}
