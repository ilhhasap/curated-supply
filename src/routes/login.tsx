import { createFileRoute, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Frame } from "@/components/shell";
import { Button } from "@/components/ui/button";

type Search = { redirect: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const raw = typeof search.redirect === "string" ? search.redirect : "/";
    const path = raw.startsWith("/") && !raw.startsWith("//") ? raw.split("?")[0] || "/" : "/";
    return { redirect: path };
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  const { user, isPending } = useCurrentUserState();
  if (!isPending && user) return <Navigate to={redirect} />;
  return (
    <Frame mark="login">
      <h1 className="text-3xl">Sign in</h1>
      <p className="mt-3 max-w-md text-quiet">Sign in to submit what you use, and to keep a kit.</p>
      <div className="mt-8 flex max-w-sm flex-col items-start gap-3">
        {isPending ? <p className="font-mono text-sm text-quiet">Loading</p> : null}
        {!isPending && authEnabled
          ? GROK_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                variant="line"
                className="w-full"
                onClick={() => signIn(provider.providerId, { callbackURL: redirect })}
              >
                Continue with {provider.label}
              </Button>
            ))
          : null}
        {!isPending && !authEnabled ? <p className="text-sm text-quiet">Sign-in is disabled.</p> : null}
      </div>
    </Frame>
  );
}
