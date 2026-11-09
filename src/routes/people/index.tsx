import { createFileRoute, Link } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { TextIndex } from "@/components/text-index";
import { listPeople } from "@/lib/held/api";

export const Route = createFileRoute("/people/")({
  loader: () => listPeople(),
  component: PeoplePage,
});

function PeoplePage() {
  const rows = Route.useLoaderData();
  return (
    <Frame mark="people">
      <h1 className="mb-8 text-3xl">People</h1>
      <TextIndex
        rows={rows}
        name={(row) => (
          <Link to="/people/$handle" params={{ handle: row.slug }} className="hover:underline">
            {row.name}
          </Link>
        )}
      />
    </Frame>
  );
}
