import { createFileRoute, Link, Navigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Frame } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getKit, removeUse, updateOwnProduct, updateUse } from "@/lib/held/api";
import { formatCardPrice } from "@/lib/held/format";
import { CATEGORIES, type Category, type KitItem, type ProductStatus } from "@/lib/held/types";

export const Route = createFileRoute("/me")({
  component: KitPage,
});

const GROUPS: { status: ProductStatus; label: string; mark: string }[] = [
  { status: "live", label: "Live", mark: "kit-live" },
  { status: "in_review", label: "In review", mark: "kit-review" },
  { status: "needs_edit", label: "Needs edit", mark: "kit-edit" },
];

function KitPage() {
  const { user, isPending } = useCurrentUserState();
  const [items, setItems] = useState<KitItem[] | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const result = await getKit();
      setItems(result.items);
      setError("");
    } catch {
      setError("Could not load your kit.");
      setItems([]);
    }
  }

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    getKit()
      .then((result) => {
        if (!cancel) setItems(result.items);
      })
      .catch(() => {
        if (!cancel) {
          setError("Could not load your kit.");
          setItems([]);
        }
      });
    return () => {
      cancel = true;
    };
  }, [user?.id]);

  if (isPending || (user && items === null)) {
    return (
      <Frame mark="kit">
        <p className="font-mono text-sm text-quiet">Loading</p>
      </Frame>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/me" }} />;

  return (
    <Frame mark="kit">
      <h1 className="text-3xl">My kit</h1>
      <p className="mt-3 max-w-md text-quiet">Live, in review, and anything an editor sent back.</p>
      {error ? <p className="mt-4 text-sm">{error}</p> : null}
      <div className="mt-10 flex flex-col gap-12">
        {GROUPS.map((group) => {
          const rows = (items ?? []).filter((item) => item.status === group.status);
          return (
            <section key={group.status} data-annotate={group.mark}>
              <h2 className="font-mono text-sm">{group.label}</h2>
              {!rows.length ? <p className="mt-3 text-quiet">Nothing here.</p> : null}
              <ul>
                {rows.map((item) => (
                  <KitRow key={item.useId} item={item} displayName={user.displayName || "Member"} onChange={load} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Frame>
  );
}

function KitRow({ item, displayName, onChange }: { item: KitItem; displayName: string; onChange: () => void }) {
  const router = useRouter();
  const [note, setNote] = useState(item.note);
  const [year, setYear] = useState(item.sinceYear ? String(item.sinceYear) : "");
  const [editing, setEditing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");

  async function saveNote() {
    setError("");
    const result = await updateUse({
      data: { useId: item.useId, note, sinceYear: year ? Number(year) : null },
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    await router.invalidate();
    onChange();
  }

  async function remove() {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    await removeUse({ data: item.useId });
    onChange();
  }

  return (
    <li className="grid gap-4 border-b border-line py-6 md:grid-cols-[96px_1fr]">
      <img src={item.photo} alt="" className="aspect-square w-24 bg-photo object-contain" />
      <div>
        {item.status === "live" ? (
          <Link to="/products/$slug" params={{ slug: item.slug }} className="hover:underline">
            {item.name}
          </Link>
        ) : (
          <p>{item.name}</p>
        )}
        <p className="font-mono text-xs text-quiet">
          {item.brandName} · {formatCardPrice(item.price)} · {item.officialHost}
        </p>
        {item.rejectReason ? <p className="mt-2 text-sm">Needs edit: {item.rejectReason}.</p> : null}
        {!editing ? <p className="mt-2 max-w-xl text-sm text-quiet">{item.note}</p> : null}
        {editing ? (
          <div className="mt-3 flex max-w-md flex-col gap-2">
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
            <Input inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Year" />
            <Button onClick={saveNote}>Save note</Button>
          </div>
        ) : (
          <div className="mt-3 flex gap-4">
            <Button onClick={() => setEditing(true)}>Edit note</Button>
            {item.introducedByMe && item.status !== "live" ? (
              <Button onClick={() => setFixing((value) => !value)}>Fix submission</Button>
            ) : null}
            <Button onClick={remove}>{confirm ? "Confirm remove" : "Remove from my kit"}</Button>
          </div>
        )}
        {error ? <p className="mt-2 text-sm">{error}</p> : null}
        {fixing ? (
          <FixForm item={item} displayName={displayName} onDone={() => { setFixing(false); onChange(); }} />
        ) : null}
      </div>
    </li>
  );
}

function FixForm({ item, displayName, onDone }: { item: KitItem; displayName: string; onDone: () => void }) {
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brandName);
  const [category, setCategory] = useState<Category>(
    (CATEGORIES as readonly string[]).includes(item.category) ? (item.category as Category) : "Tech",
  );
  const [url, setUrl] = useState(item.officialUrl);
  const [price, setPrice] = useState(String(item.price));
  const [what, setWhat] = useState(item.what);
  const [note, setNote] = useState(item.note);
  const [year, setYear] = useState(item.sinceYear ? String(item.sinceYear) : "");
  const [photo, setPhoto] = useState("");
  const [original, setOriginal] = useState(false);
  const [claim, setClaim] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setError("");
    const result = await updateOwnProduct({
      data: {
        slug: item.slug,
        name,
        brand,
        category,
        url,
        price: Number(price),
        photo,
        what,
        note,
        sinceYear: year ? Number(year) : null,
        original,
        officialClaim: claim,
        displayName,
      },
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <div className="mt-4 flex max-w-md flex-col gap-3 border-t border-line pt-4">
      <Label htmlFor={`name-${item.slug}`}>Name</Label>
      <Input id={`name-${item.slug}`} value={name} onChange={(event) => setName(event.target.value)} />
      <Label htmlFor={`brand-${item.slug}`}>Brand</Label>
      <Input id={`brand-${item.slug}`} value={brand} onChange={(event) => setBrand(event.target.value)} />
      <div className="flex flex-wrap gap-3 font-mono text-sm">
        {CATEGORIES.map((entry) => (
          <button
            key={entry}
            type="button"
            className={category === entry ? "underline" : "text-quiet hover:underline"}
            onClick={() => setCategory(entry)}
          >
            {entry}
          </button>
        ))}
      </div>
      <Label htmlFor={`url-${item.slug}`}>Official URL</Label>
      <Input id={`url-${item.slug}`} value={url} onChange={(event) => setUrl(event.target.value)} />
      <Label htmlFor={`price-${item.slug}`}>Price, IDR</Label>
      <Input id={`price-${item.slug}`} inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} />
      <Label htmlFor={`what-${item.slug}`}>What it is</Label>
      <Textarea id={`what-${item.slug}`} value={what} onChange={(event) => setWhat(event.target.value)} className="min-h-16" />
      <Label htmlFor={`note-${item.slug}`}>Note</Label>
      <Textarea id={`note-${item.slug}`} value={note} onChange={(event) => setNote(event.target.value)} />
      <Input inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} placeholder="Year" />
      <label className="font-mono text-sm hover:underline">
        Replace photo
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : "");
            reader.readAsDataURL(file);
          }}
        />
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={original} onCheckedChange={(value) => setOriginal(value === true)} />
        I use an original of this.
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={claim} onCheckedChange={(value) => setClaim(value === true)} />
        This URL is the official brand or store.
      </label>
      {error ? <p className="text-sm">{error}</p> : null}
      <Button onClick={save}>Save submission</Button>
    </div>
  );
}
