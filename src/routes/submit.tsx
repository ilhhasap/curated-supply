import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Frame } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { holdExisting, introduceProduct, listBrands, previewProduct, searchLive } from "@/lib/held/api";
import { canonicalUrl } from "@/lib/held/url";
import { CATEGORIES, type Category } from "@/lib/held/types";

export const Route = createFileRoute("/submit")({
  component: SubmitPage,
});

type Hit = { slug: string; name: string; brand_name: string };
type Phase =
  | { kind: "search" }
  | { kind: "hold"; slug: string; name: string }
  | { kind: "new" }
  | { kind: "review" };

function SubmitPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "search" });
  const [brands, setBrands] = useState<string[]>([]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancel = false;
    const timer = setTimeout(() => {
      searchLive({ data: query.trim() })
        .then((rows) => {
          if (!cancel) setHits(rows);
        })
        .catch(() => {
          if (!cancel) setHits([]);
        });
    }, 200);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (phase.kind !== "new") return;
    listBrands()
      .then((rows) => setBrands(rows.map((row) => row.name)))
      .catch(() => setBrands([]));
  }, [phase.kind]);

  if (isPending) {
    return (
      <Frame mark="submit">
        <p className="font-mono text-sm text-quiet">Loading</p>
      </Frame>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/submit" }} />;

  const displayName = user.displayName || user.primaryEmail?.split("@")[0] || "Member";

  return (
    <Frame mark="submit">
      <h1 className="text-3xl">Submit</h1>
      <p className="mt-3 max-w-md text-quiet">What you use. Originals only. Official links only.</p>
      {phase.kind === "review" ? (
        <div className="mt-10 max-w-md" data-annotate="submit-status">
          <p>In review. It stays in your kit until an editor approves it. It is not public yet.</p>
          <Link to="/me" className="mt-4 inline-block font-mono text-sm hover:underline">
            My kit
          </Link>
        </div>
      ) : (
        <div className="mt-10 max-w-md" data-annotate="submit-search">
          <Label htmlFor="use">What do you use?</Label>
          <Input
            id="use"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPhase({ kind: "search" });
            }}
            className="mt-2"
            autoComplete="off"
          />
          {query.trim().length >= 2 && phase.kind === "search" ? (
            <ul className="mt-4 border-t border-line">
              {hits.map((hit) => (
                <li key={hit.slug} className="border-b border-line">
                  <button
                    type="button"
                    className="flex w-full items-baseline justify-between gap-4 py-3 text-left hover:underline"
                    onClick={() => setPhase({ kind: "hold", slug: hit.slug, name: hit.name })}
                  >
                    <span>{hit.name}</span>
                    <span className="font-mono text-xs text-quiet">{hit.brand_name}</span>
                  </button>
                </li>
              ))}
              <li className="border-b border-line">
                <button
                  type="button"
                  className="w-full py-3 text-left font-mono text-sm hover:underline"
                  onClick={() => setPhase({ kind: "new" })}
                >
                  Introduce this
                </button>
              </li>
            </ul>
          ) : null}
          {phase.kind === "hold" ? (
            <HoldForm
              slug={phase.slug}
              productName={phase.name}
              displayName={displayName}
              onDone={(slug) => navigate({ to: "/products/$slug", params: { slug } })}
            />
          ) : null}
          {phase.kind === "new" ? (
            <NewForm
              initialName={query.trim()}
              brands={brands}
              displayName={displayName}
              onLive={(slug) => navigate({ to: "/products/$slug", params: { slug } })}
              onReview={() => setPhase({ kind: "review" })}
            />
          ) : null}
        </div>
      )}
    </Frame>
  );
}

function HoldForm({
  slug,
  productName,
  displayName,
  onDone,
}: {
  slug: string;
  productName: string;
  displayName: string;
  onDone: (slug: string) => void;
}) {
  const [note, setNote] = useState("");
  const [year, setYear] = useState("");
  const [original, setOriginal] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const length = note.trim().length;

  async function publish() {
    setPending(true);
    setError("");
    const result = await holdExisting({
      data: { slug, note, sinceYear: year ? Number(year) : null, original, name: displayName },
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onDone(result.slug);
  }

  return (
    <div className="mt-8 flex flex-col gap-3" data-annotate="submit-hold">
      <p className="font-mono text-xs text-quiet">Add {productName} to your kit</p>
      <Label htmlFor="note">Note</Label>
      <Textarea id="note" value={note} onChange={(event) => setNote(event.target.value)} />
      <p className="font-mono text-xs text-quiet">{length} / 40–280</p>
      <Label htmlFor="year">Year, optional</Label>
      <Input id="year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={original} onCheckedChange={(value) => setOriginal(value === true)} />
        I use an original of this.
      </label>
      {error ? <p className="text-sm">{error}</p> : null}
      <Button onClick={publish} disabled={pending || length < 40 || length > 280 || !original}>
        Publish
      </Button>
    </div>
  );
}

function NewForm({
  initialName,
  brands,
  displayName,
  onLive,
  onReview,
}: {
  initialName: string;
  brands: string[];
  displayName: string;
  onLive: (slug: string) => void;
  onReview: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState<Category>("Tech");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [what, setWhat] = useState("");
  const [note, setNote] = useState("");
  const [year, setYear] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoLabel, setPhotoLabel] = useState("");
  const [original, setOriginal] = useState(false);
  const [claim, setClaim] = useState(false);
  const [localError, setLocalError] = useState("");
  const [preview, setPreview] = useState<{ host: string | null; official: boolean; taken: boolean; live: boolean; duplicateSlug?: string; urlError: string | null } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const instant = url.trim() ? canonicalUrl(url) : null;
    if (instant && !instant.ok) {
      setLocalError(instant.reason);
    } else {
      setLocalError("");
    }
    let cancel = false;
    const timer = setTimeout(() => {
      previewProduct({ data: { name, brand, url } })
        .then((result) => {
          if (!cancel) setPreview(result);
        })
        .catch(() => {
          if (!cancel) setPreview(null);
        });
    }, 250);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [name, brand, url]);

  function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_200_000) {
      setError("Use a smaller photo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(typeof reader.result === "string" ? reader.result : "");
      setPhotoLabel(file.name);
      setError("");
    };
    reader.readAsDataURL(file);
  }

  const urlProblem = localError || preview?.urlError || "";
  const blocked = Boolean(urlProblem) || preview?.taken || !original || !claim || pending;
  const noteLength = note.trim().length;

  async function publish() {
    setPending(true);
    setError("");
    const result = await introduceProduct({
      data: {
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
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.status === "live") onLive(result.slug);
    else onReview();
  }

  return (
    <div className="mt-8 flex flex-col gap-3" data-annotate="submit-new">
      <p className="font-mono text-xs text-quiet">Introduce this</p>
      <Label htmlFor="new-name">Name</Label>
      <Input id="new-name" value={name} onChange={(event) => setName(event.target.value)} />
      <Label htmlFor="new-brand">Brand</Label>
      <Input id="new-brand" list="brand-list" value={brand} onChange={(event) => setBrand(event.target.value)} />
      <datalist id="brand-list">
        {brands.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-3 font-mono text-sm">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            className={`py-1 hover:underline ${category === item ? "underline" : "text-quiet"}`}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <Label htmlFor="new-url">Official URL</Label>
      <Input id="new-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" />
      {urlProblem ? <p className="text-sm">{urlProblem}</p> : null}
      {preview?.host && !urlProblem ? (
        <p className="font-mono text-xs text-quiet">
          {preview.host}
          {preview.official ? " · allowlist, goes live" : " · unknown domain, in review"}
        </p>
      ) : null}
      {preview?.taken ? (
        <p className="text-sm">
          {preview.live && preview.duplicateSlug ? (
            <>
              This is already here.{" "}
              <Link to="/products/$slug" params={{ slug: preview.duplicateSlug }} className="hover:underline">
                Add it to your kit.
              </Link>
            </>
          ) : (
            "This is already submitted."
          )}
        </p>
      ) : null}
      <Label htmlFor="new-price">Price, IDR</Label>
      <Input id="new-price" inputMode="numeric" value={price} onChange={(event) => setPrice(event.target.value)} />
      <Label htmlFor="new-photo">Photo</Label>
      <label htmlFor="new-photo" className="font-mono text-sm hover:underline">
        {photoLabel || "Add a photo"}
        <input
          id="new-photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => onFile(event.target.files?.[0])}
        />
      </label>
      <p className="font-mono text-xs text-quiet">Object on a light background.</p>
      {photo ? <img src={photo} alt="" className="aspect-square w-40 bg-photo object-contain" /> : null}
      <Label htmlFor="new-what">What it is</Label>
      <Textarea id="new-what" value={what} maxLength={140} onChange={(event) => setWhat(event.target.value)} className="min-h-16" />
      <p className="font-mono text-xs text-quiet">{what.trim().length} / 140</p>
      <Label htmlFor="new-note">Note</Label>
      <Textarea id="new-note" value={note} onChange={(event) => setNote(event.target.value)} />
      <p className="font-mono text-xs text-quiet">{noteLength} / 40–280</p>
      <Label htmlFor="new-year">Year, optional</Label>
      <Input id="new-year" inputMode="numeric" value={year} onChange={(event) => setYear(event.target.value)} />
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={original} onCheckedChange={(value) => setOriginal(value === true)} />
        I use an original of this.
      </label>
      <label className="flex items-start gap-3 text-sm">
        <Checkbox checked={claim} onCheckedChange={(value) => setClaim(value === true)} />
        This URL is the official brand or store.
      </label>
      {error ? <p className="text-sm">{error}</p> : null}
      <Button
        onClick={publish}
        disabled={
          blocked ||
          name.trim().length < 2 ||
          brand.trim().length < 2 ||
          !photo ||
          !what.trim() ||
          noteLength < 40 ||
          noteLength > 280 ||
          !price
        }
      >
        Publish
      </Button>
    </div>
  );
}
