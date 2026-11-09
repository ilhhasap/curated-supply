import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Frame } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { approveProduct, getAdmin, rejectProduct, setFeatured } from "@/lib/held/api";
import { formatIdr, formatNoted } from "@/lib/held/format";
import { useHeld } from "@/lib/held/session";
import { REJECT_REASONS, type AdminData, type AdminLiveItem, type ReviewItem } from "@/lib/held/types";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Queue" },
  { id: "returned", label: "Sent back" },
  { id: "featured", label: "Featured" },
  { id: "allowlist", label: "Allowlist" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => {
    const tab = String(search.tab ?? "overview");
    return { tab: TABS.some((item) => item.id === tab) ? (tab as Tab) : "overview" };
  },
  component: AdminPage,
});

function AdminPage() {
  const { tab } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  const person = useHeld((state) => state.person);
  const ready = useHeld((state) => state.ready);
  const [data, setData] = useState<AdminData | null>(null);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const result = await getAdmin();
    setData(result);
    setLoaded(true);
  }

  useEffect(() => {
    if (!user || person?.role !== "editor") return;
    let cancel = false;
    getAdmin()
      .then((result) => {
        if (cancel) return;
        setData(result);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, [user?.id, person?.role]);

  if (isPending || (user && !ready)) {
    return (
      <Frame mark="admin">
        <p className="text-sm text-quiet">Loading</p>
      </Frame>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/admin" }} />;
  if (person?.role !== "editor" || data?.forbidden) {
    return (
      <Frame mark="admin">
        <h1 className="text-3xl font-medium tracking-tight">Admin</h1>
        <p className="mt-3 text-quiet">This panel is for editors.</p>
      </Frame>
    );
  }

  return (
    <Frame mark="admin">
      <div className="pb-28">
        <h1 className="text-3xl font-medium tracking-tight">Admin</h1>
        <p className="mt-2 max-w-md text-sm text-quiet">Review submissions, feature products, and see the allowlist.</p>
        <div className="mt-6 flex gap-2 overflow-x-auto lg:hidden">
          {TABS.map((item) => (
            <TabLink key={item.id} id={item.id} label={item.label} current={tab} />
          ))}
        </div>
        <div className="mt-6 lg:grid lg:grid-cols-[11rem_1fr] lg:items-start lg:gap-10">
          <nav className="sticky top-6 hidden flex-col gap-1 lg:flex">
            {TABS.map((item) => (
              <TabLink key={item.id} id={item.id} label={item.label} current={tab} />
            ))}
          </nav>
          <div>
            {!loaded || !data ? <p className="text-sm text-quiet">Loading</p> : null}
            {loaded && data && tab === "overview" ? <Overview data={data} /> : null}
            {loaded && data && tab === "queue" ? <Queue items={data.queue} onDone={load} /> : null}
            {loaded && data && tab === "returned" ? <Returned items={data.returned} /> : null}
            {loaded && data && tab === "featured" ? <Featured items={data.live} onDone={load} /> : null}
            {loaded && data && tab === "allowlist" ? <Allowlist hosts={data.allowlist} /> : null}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function TabLink({ id, label, current }: { id: Tab; label: string; current: Tab }) {
  const on = id === current;
  return (
    <Link
      to="/admin"
      search={{ tab: id }}
      className={`inline-flex h-11 shrink-0 items-center rounded-full px-4 text-sm lg:justify-start ${on ? "bg-card text-ink" : "text-quiet"}`}
    >
      {label}
    </Link>
  );
}

function Overview({ data }: { data: AdminData }) {
  const featured = data.live.filter((item) => item.featured).length;
  const stats = [
    { label: "In review", value: data.queue.length, tab: "queue" as const },
    { label: "Sent back", value: data.returned.length, tab: "returned" as const },
    { label: "Live", value: data.live.length, tab: "featured" as const },
    { label: "Featured", value: featured, tab: "featured" as const },
    { label: "Allowlist", value: data.allowlist.length, tab: "allowlist" as const },
    { label: "People", value: data.people, tab: "overview" as const },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} to="/admin" search={{ tab: stat.tab }} className="rounded-card bg-card p-5">
            <p className="text-sm text-quiet">{stat.label}</p>
            <p className="mt-3 text-3xl font-medium tracking-tight">{stat.value}</p>
          </Link>
        ))}
      </div>
      <section className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm text-quiet">Waiting</h2>
          <Link to="/admin" search={{ tab: "queue" }} className="text-sm hover:underline">
            Open queue
          </Link>
        </div>
        {data.queue.length ? (
          <ul className="flex flex-col gap-3">
            {data.queue.slice(0, 3).map((item) => (
              <li key={item.slug} className="flex items-center gap-4 rounded-card bg-card p-3">
                <img src={item.photo} alt="" className="size-16 object-contain" />
                <div className="min-w-0">
                  <p className="truncate">{item.name}</p>
                  <p className="text-sm text-quiet">
                    {item.brandName} · {item.officialHost}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-quiet">Nothing is waiting.</p>
        )}
      </section>
    </div>
  );
}

function Queue({ items, onDone }: { items: ReviewItem[]; onDone: () => Promise<void> }) {
  if (!items.length) return <p className="text-quiet">The queue is empty.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <QueueCard key={item.slug} item={item} onDone={onDone} />
      ))}
    </ul>
  );
}

function QueueCard({ item, onDone }: { item: ReviewItem; onDone: () => Promise<void> }) {
  const [addHost, setAddHost] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    if (pending) return;
    setPending(true);
    setError("");
    const result = await task();
    if (!result.ok) {
      setError(result.error || "Could not save that.");
      setPending(false);
      return;
    }
    await onDone();
    setPending(false);
  }

  return (
    <li className="rounded-card bg-card p-4 md:p-5">
      <div className="grid gap-4 md:grid-cols-[140px_1fr]">
        <img src={item.photo} alt="" className="aspect-square w-full max-w-36 object-contain" />
        <div>
          <h2 className="text-xl font-medium tracking-tight">{item.name}</h2>
          <p className="mt-1 text-sm text-quiet">
            {item.brandName} · {formatIdr(item.price)} · {formatNoted(item.notedOn)}
          </p>
          <p className="mt-3 max-w-xl text-sm">{item.what}</p>
          <a href={item.officialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm hover:underline">
            {item.officialHost}
          </a>
          <p className="mt-2 text-sm">
            <Link to="/people/$handle" params={{ handle: item.submitterHandle }} className="hover:underline">
              {item.submitterName}
            </Link>
          </p>
          <label className="mt-4 flex min-h-11 items-center gap-3 text-sm">
            <Checkbox checked={addHost} onCheckedChange={(value) => setAddHost(value === true)} className="size-5" />
            Add {item.officialHost} to the allowlist
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              variant="line"
              className="h-11 px-5"
              disabled={pending}
              onClick={() => run(() => approveProduct({ data: { slug: item.slug, addHost } }))}
            >
              Approve
            </Button>
            <Link to="/products/$slug" params={{ slug: item.slug }} className="inline-flex h-11 items-center text-sm text-quiet">
              Open
            </Link>
          </div>
          <p className="mt-5 text-sm text-quiet">Send back</p>
          <div className="mt-2 flex flex-col items-start gap-1">
            {REJECT_REASONS.map((reason) => (
              <Button
                key={reason}
                className="h-11 text-quiet"
                disabled={pending}
                onClick={() => run(() => rejectProduct({ data: { slug: item.slug, reason } }))}
              >
                {reason}
              </Button>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm">{error}</p> : null}
        </div>
      </div>
    </li>
  );
}

function Returned({ items }: { items: AdminData["returned"] }) {
  if (!items.length) return <p className="text-quiet">Nothing has been sent back.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.slug} className="flex gap-4 rounded-card bg-card p-4">
          <img src={item.photo} alt="" className="size-20 object-contain" />
          <div className="min-w-0">
            <Link to="/products/$slug" params={{ slug: item.slug }} className="hover:underline">
              {item.name}
            </Link>
            <p className="mt-1 text-sm text-quiet">
              {item.brandName} · {item.submitterName}
            </p>
            <p className="mt-2 text-sm">{item.rejectReason || "Needs an edit"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Featured({ items, onDone }: { items: AdminLiveItem[]; onDone: () => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter((item) => `${item.name} ${item.brandName} ${item.category}`.toLowerCase().includes(needle))
    : items;

  return (
    <div>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter live products" />
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((item) => (
          <li key={item.slug} className="flex flex-col rounded-card bg-card p-3">
            <img src={item.photo} alt="" className="aspect-square w-full object-contain" />
            <div className="mt-2 flex items-end justify-between gap-3 px-1 pb-1">
              <div className="min-w-0">
                <Link to="/products/$slug" params={{ slug: item.slug }} className="hover:underline">
                  {item.name}
                </Link>
                <p className="text-sm text-quiet">
                  {item.brandName} · {item.category}
                </p>
              </div>
              <Button
                className="h-11 shrink-0"
                disabled={pending === item.slug}
                onClick={async () => {
                  setPending(item.slug);
                  await setFeatured({ data: { slug: item.slug, featured: !item.featured } });
                  await onDone();
                  setPending("");
                }}
              >
                {item.featured ? "Unfeature" : "Feature"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!shown.length ? <p className="mt-6 text-sm text-quiet">No live products match.</p> : null}
    </div>
  );
}

function Allowlist({ hosts }: { hosts: AdminData["allowlist"] }) {
  return (
    <div>
      <p className="max-w-md text-sm text-quiet">
        A host is added only when an editor approves a submission and ticks the allowlist box. Official badges use this list.
      </p>
      <ul className="mt-4 rounded-card bg-card px-5">
        {hosts.map((host) => (
          <li key={host.host} className="flex items-baseline justify-between gap-4 border-b border-line py-4 last:border-b-0">
            <span>{host.host}</span>
            <span className="text-sm text-quiet">{formatNoted(host.addedAt)}</span>
          </li>
        ))}
      </ul>
      {!hosts.length ? <p className="mt-4 text-sm text-quiet">The allowlist is empty.</p> : null}
    </div>
  );
}
