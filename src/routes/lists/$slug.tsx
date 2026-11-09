import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { ProductGrid } from "@/components/product-card";
import { getList } from "@/lib/held/api";

export const Route = createFileRoute("/lists/$slug")({
  loader: async ({ params }) => {
    const list = await getList({ data: params.slug });
    if (!list) throw notFound();
    return list;
  },
  component: ListPage,
});

function ListPage() {
  const list = Route.useLoaderData();
  return (
    <Frame mark="list">
      <header className="mb-8 max-w-xl" data-annotate="list-header">
        <h1 className="text-3xl">{list.title}</h1>
        <p className="mt-3 text-pretty">{list.sentence}</p>
        <p className="mt-3 font-mono text-sm text-quiet">
          By{" "}
          <Link to="/people/$handle" params={{ handle: list.authorHandle }} className="hover:underline">
            {list.authorName}
          </Link>
        </p>
      </header>
      <ProductGrid items={list.items} />
    </Frame>
  );
}
