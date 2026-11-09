import { createFileRoute, Link } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { TextIndex } from "@/components/text-index";
import { listLists } from "@/lib/held/api";

export const Route = createFileRoute("/lists/")({
  loader: () => listLists(),
  component: ListsPage,
});

function ListsPage() {
  const rows = Route.useLoaderData();
  return (
    <Frame mark="lists">
      <h1 className="mb-8 text-3xl">Lists</h1>
      <TextIndex
        rows={rows}
        name={(row) => (
          <Link to="/lists/$slug" params={{ slug: row.slug }} className="hover:underline">
            {row.name}
          </Link>
        )}
      />
    </Frame>
  );
}
