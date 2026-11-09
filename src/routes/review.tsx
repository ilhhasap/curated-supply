import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Frame } from "@/components/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { approveProduct, getReview, rejectProduct, setFeatured } from "@/lib/held/api";
import { formatNoted } from "@/lib/held/format";
import { useHeld } from "@/lib/held/session";
import { REJECT_REASONS, type LiveFeature, type ReviewItem } from "@/lib/held/types";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

function ReviewPage() {
  const { user, isPending } = useCurrentUserState();
  const person = useHeld((state) => state.person);
  const ready = useHeld((state) => state.ready);
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [live, setLive] = useState<LiveFeature[]>([]);
  const [forbidden, setForbidden] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const result = await getReview();
    setForbidden(result.forbidden);
    setQueue(result.queue);
    setLive(result.live);
    setLoaded(true);
  }

  useEffect(() => {
    if (!user || person?.role !== "editor") return;
    let cancel = false;
    getReview()
      .then((result) => {
        if (cancel) return;
        setForbidden(result.forbidden);
        setQueue(result.queue);
        setLive(result.live);
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
      <Frame mark="review">
        <p className="font-mono text-sm text-quiet">Loading</p>
      </Frame>
    );
  }
  if (!user) return <Navigate to="/login" search={{ redirect: "/review" }} />;
  if (person?.role !== "editor" || forbidden) {
    return (
      <Frame mark="review">
        <h1 className="text-3xl">Review</h1>
        <p className="mt-3 text-quiet">This queue is for editors.</p>
      </Frame>
    );
  }

  return (
    <Frame mark="review">
      <h1 className="text-3xl">Review</h1>
      <p className="mt-3 max-w-md text-quiet">Unknown domains wait here. Approving makes a product live.</p>
      {!loaded ? <p className="mt-6 font-mono text-sm text-quiet">Loading</p> : null}
      {loaded && !queue.length ? <p className="mt-8 text-quiet">The queue is empty.</p> : null}
      <ul data-annotate="review-queue">
        {queue.map((item) => (
          <QueueRow key={item.slug} item={item} onDone={load} />
        ))}
      </ul>
      <section className="mt-14" data-annotate="review-featured">
        <h2 className="font-mono text-sm">Featured</h2>
        <ul className="mt-2">
          {live.map((item) => (
            <li key={item.slug} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
              <Link to="/products/$slug" params={{ slug: item.slug }} className="hover:underline">
                {item.name}
              </Link>
              <Button
                onClick={async () => {
                  await setFeatured({ data: { slug: item.slug, featured: !item.featured } });
                  await load();
                }}
              >
                {item.featured ? "Unfeature" : "Feature"}
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </Frame>
  );
}

function QueueRow({ item, onDone }: { item: ReviewItem; onDone: () => void }) {
  const [addHost, setAddHost] = useState(false);
  const [error, setError] = useState("");

  return (
    <li className="grid gap-4 border-b border-line py-6 md:grid-cols-[120px_1fr]">
      <img src={item.photo} alt="" className="aspect-square w-full max-w-28 bg-photo object-contain" />
      <div>
        <h2>{item.name}</h2>
        <p className="font-mono text-xs text-quiet">
          {item.brandName} · {item.officialHost}
        </p>
        <p className="mt-2 max-w-xl text-sm text-quiet">{item.what}</p>
        <a href={item.officialUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-sm hover:underline">
          {item.officialHost}
        </a>
        <p className="mt-2 text-sm">
          <Link to="/people/$handle" params={{ handle: item.submitterHandle }} className="hover:underline">
            {item.submitterName}
          </Link>
          <span className="text-quiet"> · {formatNoted(item.notedOn)}</span>
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <Checkbox checked={addHost} onCheckedChange={(value) => setAddHost(value === true)} />
          Add {item.officialHost} to the allowlist
        </label>
        <div className="mt-3 flex flex-wrap gap-4">
          <Button
            onClick={async () => {
              const result = await approveProduct({ data: { slug: item.slug, addHost } });
              if (!result.ok) setError(result.error);
              else onDone();
            }}
          >
            Approve
          </Button>
          {REJECT_REASONS.map((reason) => (
            <Button
              key={reason}
              className="text-quiet"
              onClick={async () => {
                const result = await rejectProduct({ data: { slug: item.slug, reason } });
                if (!result.ok) setError(result.error);
                else onDone();
              }}
            >
              {reason}
            </Button>
          ))}
        </div>
        {error ? <p className="mt-2 text-sm">{error}</p> : null}
      </div>
    </li>
  );
}
