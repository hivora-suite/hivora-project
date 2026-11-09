"use client";

import { LayoutGrid, LogOut, Menu, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ApiError, api, type Me, type Role } from "@/lib/api/client";
import { useLogout, useMe } from "@/lib/api/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Brand } from "./brand";
import { ShelfCat } from "./shelf-cat";

const LEVEL: Record<Role, number> = { member: 0, admin: 1 };

interface Session {
  me: Me;
  can: (role: Role) => boolean;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside AppShell");
  return ctx;
}

type NavItem = { href: string; label: MessageKey; icon: typeof LayoutGrid; role: Role };

const NAV: NavItem[] = [
  { href: "/", label: "home.title", icon: LayoutGrid, role: "member" },
  { href: "/users/", label: "nav.users", icon: Users, role: "admin" },
  { href: "/settings/", label: "nav.settings", icon: Settings, role: "member" },
];

const LINK = "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-sm transition-[background-color,color,box-shadow,translate] duration-200 ease-out";
const LINK_ON = "surface font-medium before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary";
const LINK_OFF = "text-muted-foreground hover:translate-x-0.5 hover:bg-muted hover:text-foreground";

function NavTree({ pathname, can }: { pathname: string; can: (role: Role) => boolean }) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("nav.menu")} className="flex flex-col gap-1">
      {NAV.filter((n) => can(n.role)).map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className={cn(LINK, active ? LINK_ON : LINK_OFF)}>
            <n.icon className="size-4 shrink-0" /> {t(n.label)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Authenticated layout: redirects to login / forced password change / forced TOTP setup. */
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const { data: me, error, isPending } = useMe();
  // No TOTP: one guarded request tells whether this instance requires it (public); held on
  // the spinner meanwhile, so nothing shows before /setup-totp/.
  const probe = useQuery({
    queryKey: ["totp-probe", me?.id],
    queryFn: () => api<unknown>("/auth/sessions"),
    enabled: !!me && !me.must_change_password && !me.totp_enabled,
    retry: false,
  });
  const totpSetup = probe.error instanceof ApiError && probe.error.code === "totp_setup_required";
  const held = !!me && !me.totp_enabled && (probe.isPending || totpSetup);
  const logout = useLogout();
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => setMobileNav(false), [pathname]);
  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) router.replace("/login/");
    else if (me?.must_change_password) router.replace("/change-password/");
    else if (totpSetup) router.replace("/setup-totp/");
  }, [error, me, router, totpSetup]);

  if (isPending || !me || me.must_change_password || held) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div role="status" aria-label={t("common.loading")} className="size-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  const session: Session = { me, can: (role) => LEVEL[me.role] >= LEVEL[role] };

  const footer = (
    <div className="flex items-center gap-3 text-sm">
      <span className="mr-auto truncate font-medium">{me.username}</span>
      <button
        className="text-muted-foreground hover:text-foreground"
        aria-label={t("nav.logout")}
        title={t("nav.logout")}
        disabled={logout.isPending}
        onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login/") })}
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );

  return (
    <SessionContext.Provider value={session}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="relative z-10 flex shrink-0 flex-col gap-1 border-b bg-sidebar p-3 shadow-md md:sticky md:top-0 md:h-screen md:w-56 md:border-b-0 md:border-r">
          <div className="relative mb-1 flex items-center justify-center">
            <Link href="/" aria-label="Hivora Project" className="rounded-md px-2 py-1">
              <Brand />
            </Link>
            <div className="absolute right-0 flex items-center gap-2">
              <Sheet open={mobileNav} onOpenChange={setMobileNav}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden" aria-label={t("nav.menu")}>
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent title={t("nav.menu")} closeLabel={t("common.close")} resizeLabel={t("common.resize")} widthKey="nav">
                  <NavTree pathname={pathname} can={session.can} />
                  <div className="mt-6 grid gap-3 border-t pt-4">{footer}</div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <div className="hidden md:block">
            <NavTree pathname={pathname} can={session.can} />
          </div>
          <div className="mt-auto hidden flex-col gap-2 px-2 pt-3 md:flex">
            <ShelfCat />
            {footer}
          </div>
        </aside>
        <main key={pathname} className="animate-enter min-w-0 flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </SessionContext.Provider>
  );
}

export function PageHeader({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
