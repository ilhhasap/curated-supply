import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { syncPerson } from "@/lib/held/api";
import { useHeld } from "@/lib/held/session";
import { CommentLayer } from "@/components/comment-layer";
import { CATEGORIES } from "@/lib/held/types";

const NAV = [
  { label: "For you", to: "/for-you" },
  { label: "Browse", to: "/" },
  { label: "Brands", to: "/brands" },
  { label: "Lists", to: "/lists" },
  { label: "People", to: "/people" },
] as const;

const MORE = [
  { label: "Categories", to: "/categories" },
  { label: "Submit", to: "/submit" },
  { label: "My kit", to: "/me" },
] as const;

function active(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

function Mark({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.15 1.5h3.7l.85 8.55 7.55-4.55 1.9 3.15-6.9 5.35 6.9 5.35-1.9 3.15-7.55-4.55-.85 8.55h-3.7l-.85-8.55-7.55 4.55-1.9-3.15 6.9-5.35-6.9-5.35 1.9-3.15 7.55 4.55.85-8.55z"
      />
    </svg>
  );
}

function AccountSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <span className="inline-block size-9" />;
  if (!user) {
    return (
      <Link
        to="/login"
        search={{ redirect: "/" }}
        className="inline-flex h-9 items-center rounded-full bg-card px-4 text-sm hover:text-ink"
      >
        Sign in
      </Link>
    );
  }
  return <UserButton />;
}

function PersonSync() {
  const { user, isPending } = useCurrentUserState();
  const setPerson = useHeld((state) => state.setPerson);
  const userId = user?.id;
  const name = user?.displayName || user?.primaryEmail?.split("@")[0] || "Member";
  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      setPerson(null);
      return;
    }
    let cancel = false;
    syncPerson({ data: { name } })
      .then((person) => {
        if (!cancel) setPerson(person);
      })
      .catch(() => {
        if (!cancel) setPerson(null);
      });
    return () => {
      cancel = true;
    };
  }, [isPending, userId, name, setPerson]);
  return null;
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV.map((item) => {
        const on = active(pathname, item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`rounded-full px-3 py-1.5 text-sm ${on ? "bg-card text-ink" : "text-quiet hover:text-ink"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const person = useHeld((state) => state.person);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen">
      <PersonSync />
      <header data-annotate="nav" className="mx-auto w-full max-w-[1320px] px-4 pt-5 md:px-8">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <Link to="/" aria-label="Held, home" className="text-ink">
            <Mark />
          </Link>
          <nav className="hidden items-center justify-center gap-1 md:flex">
            <NavLinks pathname={pathname} />
          </nav>
          <div className="hidden items-center justify-end gap-3 md:flex">
            {person?.role === "editor" ? (
              <Link to="/admin" search={{ tab: "overview" }} className="text-sm text-quiet hover:text-ink">
                Admin
              </Link>
            ) : null}
            <AccountSlot />
          </div>
          <div className="col-start-3 flex justify-end md:hidden">
            <button
              type="button"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((value) => !value)}
              className="grid size-10 place-items-center rounded-full bg-card text-ink"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </button>
          </div>
        </div>
        {open ? (
          <div className="mt-3 flex flex-col gap-1 rounded-card bg-card p-3 md:hidden">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            {MORE.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-2 text-sm text-quiet hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
            {person?.role === "editor" ? (
              <Link to="/admin" search={{ tab: "overview" }} className="rounded-full px-3 py-2 text-sm text-quiet">
                Admin
              </Link>
            ) : null}
            <div className="px-3 py-2">
              <AccountSlot />
            </div>
          </div>
        ) : null}
      </header>
      {children}
      <footer className="mx-auto w-full max-w-[1320px] px-4 pt-16 pb-10 md:px-8">
        <div className="grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] md:gap-16">
          <div>
            <Mark />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-quiet">
              Not a store. Links go only to the official brand. Prices are noted when someone adds a product,
              and they can change.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <p className="text-quiet">Navigation</p>
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} className="hover:underline">
                  {item.label}
                </Link>
              ))}
              <Link to="/categories" className="hover:underline">
                Categories
              </Link>
              <Link to="/submit" className="hover:underline">
                Submit
              </Link>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-quiet">Categories</p>
              {CATEGORIES.map((name) => (
                <Link
                  key={name}
                  to="/categories/$slug"
                  params={{ slug: name.toLowerCase() }}
                  className="hover:underline"
                >
                  {name}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-quiet">Account</p>
              <Link to="/me" className="hover:underline">
                My kit
              </Link>
              <Link to="/people" className="hover:underline">
                People
              </Link>
              <Link to="/lists" className="hover:underline">
                Lists
              </Link>
            </div>
          </div>
        </div>
        <p className="mt-14 text-sm text-quiet">Held. A directory of things people use.</p>
      </footer>
      <CommentLayer />
    </div>
  );
}

export function Frame({ children, mark }: { children: ReactNode; mark?: string }) {
  return (
    <main data-annotate={mark} className="mx-auto w-full max-w-[1320px] px-4 pt-8 pb-4 md:px-8">
      {children}
    </main>
  );
}