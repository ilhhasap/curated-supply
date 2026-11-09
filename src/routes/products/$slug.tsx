import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProductGrid } from "@/components/product-card";
import { Frame } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { editorUpdateProduct, getProduct, holdExisting, relationTo, setFeatured } from "@/lib/held/api";
import { formatIdr, formatNoted, initials } from "@/lib/held/format";
import { useHeld } from "@/lib/held/session";
import { CATEGORIES } from "@/lib/held/types";

export const Route = createFileRoute("/products/$slug")({
  loader: async ({ params }) => {
    const product = await getProduct({ data: params.slug });
    if (!product) throw notFound();
    return product;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.name} — Held` : "Held" }],
  }),
  component: ProductPage,
});

function ProductPage() {
  const product = Route.useLoaderData();
  const router = useRouter();
  const { user, isPending } = useCurrentUserState();
  const person = useHeld((state) => state.person);
  const [holds, setHolds] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [year, setYear] = useState("");
  const [original, setOriginal] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!user) {
      setHolds(null);
      return;
    }
    let cancel = false;
    relationTo({ data: product.slug })
      .then((result) => {
        if (!cancel) setHolds(result.holds);
      })
      .catch(() => {
        if (!cancel) setHolds(null);
      });
    return () => {
      cancel = true;
    };
  }, [user?.id, product.slug]);

  async function publishHold() {
    if (!user) return;
    setPending(true);
    setError("");
    const result = await holdExisting({
      data: {
        slug: product.slug,
        note,
        sinceYear: year ? Number(year) : null,
        original,
        name: user.displayName || user.primaryEmail?.split("@")[0] || "Member",
      },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setHolds(true);
    setOpen(false);
    await router.invalidate();
  }

  return (
    <Frame mark="product">
      <div className="grid gap-8 md:grid-cols-[minmax(0,28rem)_minmax(0,1fr)] md:gap-12">
        <img
          data-annotate="product-photo"
          src={product.photo}
          alt=""
          className="aspect-square w-full bg-photo object-contain"
        />
        <div data-annotate="product-facts" className="flex flex-col gap-4">
          {product.official ? <Badge>Official</Badge> : null}
          <h1 className="text-3xl text-balance">{product.name}</h1>
          <p className="text-sm">
            <Link to="/brands/$slug" params={{ slug: product.brandSlug }} className="hover:underline">
              {product.brandName}
            </Link>
            <span className="text-quiet"> · </span>
            <Link
              to="/categories/$slug"
              params={{ slug: product.category.toLowerCase() }}
              className="hover:underline"
            >
              {product.category}
            </Link>
          </p>
          <p className="font-mono text-sm">
            {formatIdr(product.price)}
            <span className="text-quiet"> · noted {formatNoted(product.notedOn)}</span>
          </p>
          <p className="max-w-md text-quiet">{product.what}</p>
          {product.note ? (
            <blockquote data-annotate="product-note" className="max-w-md">
              <p>{product.note}</p>
              {product.sinceYear ? (
                <p className="mt-2 font-mono text-xs text-quiet">Since {product.sinceYear}</p>
              ) : null}
            </blockquote>
          ) : null}
          <Link
            data-annotate="product-credit"
            to="/people/$handle"
            params={{ handle: product.credit.handle }}
            className="flex items-center gap-3 hover:underline"
          >
            <Avatar>
              <AvatarFallback>{initials(product.credit.name)}</AvatarFallback>
            </Avatar>
            <span>
              <span className="block">{product.credit.name}</span>
              <span className="block text-sm text-quiet">{product.credit.city}</span>
            </span>
          </Link>
          <p data-annotate="product-action">
            <a
              href={product.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm hover:underline"
            >
              {product.officialHost}
            </a>
          </p>
          {!isPending && user && holds === false ? (
            <Button onClick={() => setOpen(true)}>{open ? "Adding to your kit" : "I use this"}</Button>
          ) : null}
          {!isPending && user && holds ? (
            <Link to="/me" className="font-mono text-sm hover:underline">
              In your kit
            </Link>
          ) : null}
          {open ? (
            <div className="flex max-w-md flex-col gap-3 border-t border-line pt-4">
              <Label htmlFor="hold-note">Note</Label>
              <Textarea id="hold-note" value={note} onChange={(event) => setNote(event.target.value)} />
              <p className="font-mono text-xs text-quiet">{note.trim().length} / 40–280</p>
              <Label htmlFor="hold-year">Year, optional</Label>
              <Input id="hold-year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={original} onCheckedChange={(value) => setOriginal(value === true)} />
                I use an original of this.
              </label>
              {error ? <p className="text-sm">{error}</p> : null}
              <Button onClick={publishHold} disabled={pending}>
                Publish
              </Button>
            </div>
          ) : null}
          {person?.role === "editor" ? (
            <EditorFacts slug={product.slug} initial={product} />
          ) : null}
        </div>
      </div>
      {product.holders.length ? (
        <section id="held-by" data-annotate="held-by" className="mt-14">
          <h2 className="mb-4 font-mono text-sm text-quiet">Also held by</h2>
          <ul>
            {product.holders.map((holder) => (
              <li key={holder.handle} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                <Link to="/people/$handle" params={{ handle: holder.handle }} className="hover:underline">
                  {holder.name}
                </Link>
                <span className="font-mono text-xs text-quiet">{holder.city}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div id="held-by" />
      )}
      {product.moreFromPerson.length ? (
        <section className="mt-14" data-annotate="more-person">
          <h2 className="mb-6 font-mono text-sm text-quiet">More from this person</h2>
          <ProductGrid items={product.moreFromPerson} />
        </section>
      ) : null}
      {product.moreInCategory.length ? (
        <section className="mt-14" data-annotate="more-category">
          <h2 className="mb-6 font-mono text-sm text-quiet">More in this category</h2>
          <ProductGrid items={product.moreInCategory} />
        </section>
      ) : null}
    </Frame>
  );
}

function EditorFacts({
  slug,
  initial,
}: {
  slug: string;
  initial: { name: string; brandName: string; category: string; officialUrl: string; price: number; what: string; featured: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [brand, setBrand] = useState(initial.brandName);
  const [category, setCategory] = useState(initial.category);
  const [url, setUrl] = useState(initial.officialUrl);
  const [price, setPrice] = useState(String(initial.price));
  const [what, setWhat] = useState(initial.what);
  const [error, setError] = useState("");
  const [featured, setFlag] = useState(initial.featured);

  async function save() {
    setError("");
    const result = await editorUpdateProduct({
      data: { slug, name, brand, category, url, price: Number(price), what, photo: "" },
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await router.invalidate();
  }

  async function feature(next: boolean) {
    const result = await setFeatured({ data: { slug, featured: next } });
    if (result.ok) {
      setFlag(next);
      await router.invalidate();
    }
  }

  return (
    <details className="mt-4 border-t border-line pt-4" data-annotate="editor-facts">
      <summary className="cursor-pointer font-mono text-sm">Edit facts</summary>
      <div className="mt-4 flex max-w-md flex-col gap-3">
        <Button onClick={() => feature(!featured)}>{featured ? "Unfeature" : "Feature"}</Button>
        <Label htmlFor="edit-name">Name</Label>
        <Input id="edit-name" value={name} onChange={(event) => setName(event.target.value)} />
        <Label htmlFor="edit-brand">Brand</Label>
        <Input id="edit-brand" value={brand} onChange={(event) => setBrand(event.target.value)} />
        <div className="flex flex-wrap gap-3 font-mono text-sm">
          {CATEGORIES.map((item) => (
            <button
              key={item}
              type="button"
              className={`hover:underline ${category === item ? "underline" : "text-quiet"}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <Label htmlFor="edit-url">Official URL</Label>
        <Input id="edit-url" value={url} onChange={(event) => setUrl(event.target.value)} />
        <Label htmlFor="edit-price">Price, IDR</Label>
        <Input id="edit-price" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} />
        <Label htmlFor="edit-what">What it is</Label>
        <Textarea id="edit-what" value={what} onChange={(event) => setWhat(event.target.value)} className="min-h-16" />
        {error ? <p className="text-sm">{error}</p> : null}
        <Button onClick={save}>Save facts</Button>
      </div>
    </details>
  );
}
