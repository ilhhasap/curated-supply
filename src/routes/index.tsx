import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { getDiscover } from "@/lib/held/api";

export const Route = createFileRoute("/")({
  loader: () => getDiscover(),
  component: BrowsePage,
});

function BrowsePage() {
  const data = Route.useLoaderData();
  return (
    <main data-annotate="discover" className="mx-auto w-full max-w-[1320px] px-4 pt-8 pb-6 md:px-8">
      <h1 className="text-4xl font-medium tracking-tight">Browse</h1>

      <Section title="By category" to="/categories">
        <CardGrid>
          {data.categories.map((item) => (
            <PhotoCard
              key={item.slug}
              to="/categories/$slug"
              params={{ slug: item.slug }}
              photo={item.photo}
              label={item.name}
              meta={String(item.count)}
            />
          ))}
        </CardGrid>
      </Section>

      <Section title="By brand" to="/brands">
        <CardGrid>
          {data.brands.map((item) => (
            <Link
              key={item.slug}
              to="/brands/$slug"
              params={{ slug: item.slug }}
              className="flex flex-col rounded-card bg-card"
            >
              <span className="grid aspect-[5/4] place-items-center px-6 text-center text-3xl font-medium tracking-tight">
                {item.name}
              </span>
              <Meta label={item.name} meta={String(item.count)} />
            </Link>
          ))}
        </CardGrid>
      </Section>

      <Section title="By list" to="/lists">
        <CardGrid>
          {data.lists.map((item) => (
            <Link
              key={item.slug}
              to="/lists/$slug"
              params={{ slug: item.slug }}
              className="flex flex-col rounded-card bg-card"
            >
              <span className="grid aspect-[5/4] grid-cols-2 content-center gap-3 px-5">
                {item.photos.slice(0, 4).map((photo) => (
                  <img key={photo} src={photo} alt="" className="aspect-square w-full object-contain" />
                ))}
              </span>
              <Meta label={item.name} meta={String(item.count)} />
            </Link>
          ))}
        </CardGrid>
      </Section>

      <Section title="By product" to="/products">
        <CardGrid>
          {data.products.map((item) => (
            <PhotoCard
              key={item.slug}
              to="/products/$slug"
              params={{ slug: item.slug }}
              photo={item.photo}
              label={item.name}
              meta={item.brandName}
            />
          ))}
        </CardGrid>
        <div className="mt-8 text-center">
          <Link to="/products" search={{ category: "all", sort: "featured" }} className="text-sm hover:underline">
            Show more
          </Link>
        </div>
      </Section>
    </main>
  );
}

function Section({
  title,
  to,
  children,
}: {
  title: string;
  to: "/categories" | "/brands" | "/lists" | "/products";
  children: ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-medium tracking-tight">{title}</h2>
        <Link to={to} className="text-sm text-quiet hover:text-ink">
          See all
        </Link>
      </div>
      {children}
    </section>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Meta({ label, meta }: { label: string; meta: string }) {
  return (
    <span className="flex items-baseline justify-between gap-3 px-4 pt-1 pb-4 text-sm">
      <span className="truncate">{label}</span>
      <span className="shrink-0">{meta}</span>
    </span>
  );
}

function PhotoCard({
  to,
  params,
  photo,
  label,
  meta,
}: {
  to: "/categories/$slug" | "/products/$slug";
  params: { slug: string };
  photo: string;
  label: string;
  meta: string;
}) {
  return (
    <Link to={to} params={params} className="group flex flex-col rounded-card bg-card">
      <span className="grid aspect-[5/4] place-items-center overflow-hidden px-6 pt-6">
        <img
          src={photo}
          alt=""
          className="max-h-full w-full object-contain motion-safe:transition motion-safe:duration-300 motion-safe:group-hover:scale-105"
        />
      </span>
      <Meta label={label} meta={meta} />
    </Link>
  );
}