"use client";

import { Bell, CalendarDays, CloudOff, House, ListChecks, Plus, Settings, ShoppingCart, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useHousehold } from "@/features/household/store";
import { useTaskUi } from "@/features/tasks/task-ui-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Vandaag", icon: House },
  { href: "/taken", label: "Taken", icon: ListChecks },
  { href: "#nieuw", label: "Taak", icon: Plus },
  { href: "/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/huishouden", label: "Huishouden", icon: Users },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { snapshot, online, pending } = useHousehold();
  const { openNewTask } = useTaskUi();
  const pathname = usePathname();
  const unread = snapshot.notifications.filter((n) => !n.read_at).length;
  const shoppingOpen = snapshot.shoppingItems.filter((i) => !i.is_bought).length;

  return (
    <div className="min-h-dvh">
      <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className={cn("mx-auto flex h-14 max-w-3xl items-center gap-2 px-4", pathname.startsWith("/kalender") && "lg:max-w-6xl")}>
          <Link href="/" className="min-w-0 flex-1 truncate font-semibold">
            <span className="mr-1.5" aria-hidden>
              🏡
            </span>
            {snapshot.household.name}
          </Link>
          <HeaderIcon href="/boodschappen" label="Boodschappen" count={shoppingOpen} active={pathname.startsWith("/boodschappen")}>
            <ShoppingCart className="size-5" />
          </HeaderIcon>
          <HeaderIcon href="/meldingen" label="Meldingen" count={unread} highlight active={pathname.startsWith("/meldingen")}>
            <Bell className="size-5" />
          </HeaderIcon>
          <HeaderIcon href="/instellingen" label="Instellingen" active={pathname.startsWith("/instellingen")}>
            <Settings className="size-5" />
          </HeaderIcon>
        </div>
        {(!online || pending > 0) && (
          <div className="flex items-center justify-center gap-2 bg-today-bg px-4 py-1.5 text-xs font-medium text-[oklch(0.45_0.1_70)] dark:text-today">
            <CloudOff className="size-3.5" />
            {!online ? "Je bent offline – je ziet de laatst geladen gegevens." : "Bezig met synchroniseren…"}
            {pending > 0 && ` ${pending} ${pending === 1 ? "wijziging wacht" : "wijzigingen wachten"}.`}
          </div>
        )}
      </header>

      <main className={cn("pb-nav mx-auto max-w-3xl px-4 pt-5", pathname.startsWith("/kalender") && "lg:max-w-6xl")}>{children}</main>

      <nav
        aria-label="Hoofdmenu"
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur-md"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
          {NAV.map((item) => {
            if (item.href === "#nieuw") {
              return (
                <li key={item.href} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => openNewTask()}
                    aria-label="Nieuwe taak"
                    className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95"
                  >
                    <Plus className="size-7" strokeWidth={2.5} />
                  </button>
                </li>
              );
            }
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function HeaderIcon({
  href,
  label,
  count,
  highlight,
  active,
  children,
}: {
  href: string;
  label: string;
  count?: number;
  highlight?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={count ? `${label} (${count})` : label}
      className={cn(
        "relative flex size-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
      {!!count && (
        <span
          className={cn(
            "absolute -top-0.5 -right-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 text-[10px] font-bold",
            highlight ? "bg-destructive text-white" : "bg-primary text-primary-foreground",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
