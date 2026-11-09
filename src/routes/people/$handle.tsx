import { createFileRoute, notFound } from "@tanstack/react-router";
import { Frame } from "@/components/shell";
import { ProductGrid } from "@/components/product-card";
import { getPerson } from "@/lib/held/api";

export const Route = createFileRoute("/people/$handle")({
  loader: async ({ params }) => {
    const person = await getPerson({ data: params.handle });
    if (!person) throw notFound();
    return person;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} — Held` : "Held" }],
  }),
  component: PersonPage,
});

function PersonPage() {
  const person = Route.useLoaderData();
  const line = [person.bio, person.city].filter(Boolean).join(" · ");
  return (
    <Frame mark="person">
      <header className="mb-8 max-w-xl" data-annotate="person-header">
        <h1 className="text-3xl">{person.name}</h1>
        {line ? <p className="mt-2 text-quiet">{line}</p> : null}
        <p className="mt-2 font-mono text-sm text-quiet">{person.count} live</p>
      </header>
      <ProductGrid items={person.items} showNote />
    </Frame>
  );
}
