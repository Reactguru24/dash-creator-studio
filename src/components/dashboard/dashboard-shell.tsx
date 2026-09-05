import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ADMIN_ONLY_PATHS, NAV, type NavSection } from "@/lib/endpoints";
import { canAccess, isClientAdmin, useAuth, useClientScope, userLabel, userRole } from "@/lib/use-auth";
import { API_BASE, type Dict } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

import { BrandLogo } from "@/components/brand-logo";


function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <Icon className={className} strokeWidth={1.75} />;
}

function filterNav(user: Dict | null, clientAdmin: boolean): NavSection[] {
  return NAV.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        canAccess(user, item.permission) &&
        !(clientAdmin && item.adminOnly) &&
        !(!clientAdmin && item.clientAdminOnly),
    ),
  })).filter((section) => section.items.length > 0);
}

export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { token, user, ready, logout, refreshMe } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (ready && !token) void navigate({ to: "/login", replace: true });
  }, [ready, token, navigate]);

  useEffect(() => {
    if (token && !user) void refreshMe();
  }, [token, user, refreshMe]);

  const scope = useClientScope(user);
  const clientAdmin = isClientAdmin(user) || scope.clientAdmin;
  const nav = useMemo(() => filterNav(user, clientAdmin), [user, clientAdmin]);
  const blocked = clientAdmin && ADMIN_ONLY_PATHS.has(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent the dashboard from flashing before the login redirect fires.
  if (!ready || !token) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <SidebarContent nav={nav} pathname={pathname} className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar lg:flex" />


        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-4 py-3 sm:px-5 lg:flex lg:px-8 lg:py-4">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground lg:hidden"
              >
                <Icons.Menu className="size-4" strokeWidth={1.75} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-display text-base font-semibold sm:text-xl">{title}</h1>
                {subtitle ? (
                  <p className="num mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 lg:col-span-1">
                {scope.clients.length > 1 ? (
                  <ClientSwitcher
                    clients={scope.clients}
                    value={scope.activeClientId ?? ""}
                    onChange={(next) => {
                      scope.setActiveClientId(next);
                      // Drop cached data from the previous client so every page refetches.
                      queryClient.clear();
                    }}
                  />
                ) : null}

                {actions}
                <ThemeToggle />
                <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 lg:flex">
                  <Icons.UserRound className="size-4 text-primary" strokeWidth={1.75} />
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-xs font-medium">{userLabel(user)}</p>
                    <p className="label-eyebrow">{userRole(user) ?? "authenticated"}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    void navigate({ to: "/login", replace: true });
                  }}
                  aria-label="Sign out"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-2 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
                >
                  <Icons.LogOut className="size-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-5 sm:py-6 lg:px-8">
            {blocked ? (
              <div className="mx-auto mt-10 max-w-md rounded-lg border border-border bg-card p-8 text-center">
                <Icons.ShieldAlert className="mx-auto size-8 text-muted-foreground" strokeWidth={1.5} />
                <h2 className="mt-3 font-display text-base font-semibold">Not available</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  This section is restricted to platform administrators. Your account only has access
                  to data for your own client.
                </p>
              </div>
            ) : (
              children
            )}
          </main>

        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <SidebarContent
            nav={nav}
            pathname={pathname}
            className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-xl"
            onClose={() => setMobileOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  nav,
  pathname,
  className,
  onClose,
}: {
  nav: NavSection[];
  pathname: string;
  className?: string;
  onClose?: () => void;
}) {
  return (
    <aside className={className}>
      <div className="flex items-center gap-2 px-4 py-5">
        <BrandLogo className="h-10 w-auto min-w-0 flex-1 object-contain object-left" />


        {onClose ? (
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground"
          >
            <Icons.X className="size-4" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {nav.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="label-eyebrow px-2 pb-2">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = pathname === item.to;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                      )}
                    >
                      <NavIcon
                        name={item.icon}
                        className={cn("size-4 shrink-0", active && "text-primary")}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* <div className="border-t border-border px-4 py-3">
        <p className="label-eyebrow">Environment</p>
        <p className="num mt-1 truncate text-xs text-muted-foreground">
          {API_BASE.replace("https://", "")}
        </p>
      </div> */}
    </aside>
  );
}

function ClientSwitcher({
  clients,
  value,
  onChange,
}: {
  clients: { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const active = clients.find((c) => c.id === value);
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label="Active operator"
        className="h-9 w-auto min-w-[12rem] gap-2 rounded-md border-border bg-card px-2.5 text-xs font-medium shadow-none transition-colors hover:border-border-strong focus:ring-1 focus:ring-primary/40"
      >
        <span className="block max-w-[12rem] truncate">
          {active?.name ?? clients[0]?.name ?? "Select operator"}
        </span>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {clients.map((client) => (
          <SelectItem key={client.id} value={client.id} className="text-xs">
            <span className="truncate">{client.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

