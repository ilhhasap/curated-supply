import { createFileRoute, notFound } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { ProductGrid } from "@/components/product-card";
import { getCategory } from "@/lib/held/api";

export const Route = createFileRoute("/categories/$slug")({
  loader: async ({ params }) => {
    const category = await getCategory({ data: params.slug });
    if (!category) throw notFound();
    return category;
  },
  component: CategoryPage,
});

function CategoryPage() {
  const category = Route.useLoaderData();
  return (
    <Frame mark="category">
      <h1 className="mb-8 text-3xl">{category.name}</h1>
      <ProductGrid items={category.items} />
    </Frame>
  );
}
