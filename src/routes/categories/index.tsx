import { createFileRoute, Link } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { TextIndex } from "@/components/text-index";
import { listCategories } from "@/lib/held/api";

export const Route = createFileRoute("/categories/")({
  loader: () => listCategories(),
  component: CategoriesPage,
});

function CategoriesPage() {
  const rows = Route.useLoaderData();
  return (
    <Frame mark="categories">
      <h1 className="mb-8 text-3xl">Categories</h1>
      <TextIndex
        rows={rows}
        name={(row) => (
          <Link to="/categories/$slug" params={{ slug: row.slug }} className="hover:underline">
            {row.name}
          </Link>
        )}
      />
    </Frame>
  );
}
