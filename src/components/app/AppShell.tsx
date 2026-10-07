"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown,
  CreditCard,
  FolderOpen,
  HelpCircle,
  Home,
  LayoutGrid,
  Menu,
  Search,
  Settings,
  X,
} from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { APP_NAV, isActive } from "@/lib/nav";

const ICONS: Record<string, typeof Home> = {
  "/dashboard": Home,
  "/workbooks": FolderOpen,
  "/billing": CreditCard,
  "/settings": Settings,
  "/help": HelpCircle,
};

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="App">
      {APP_NAV.map(({ label, href }) => {
        const Icon = ICONS[href];
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${active ? "bg-neutral-100 font-medium" : "hover:bg-neutral-50"}`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 px-6 py-5 text-lg font-semibold tracking-tight"
    >
      <LayoutGrid size={22} />
      ExcelAI
    </Link>
  );
}

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const path = usePathname();
  const inWorkspace = path.startsWith("/workspace");
  const name = email.split("@")[0];
  return (
    <div className="flex min-h-screen bg-white text-neutral-950">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50/60 lg:flex">
        <Brand />
        <Nav />
        <div className="m-4 mt-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs">
          <p className="text-neutral-500">Plan</p>
          <p className="mt-0.5 text-sm font-medium">Development account</p>
          <Link
            href="/billing"
            className="mt-1 inline-block text-neutral-500 underline"
          >
            Billing isn&apos;t enabled yet
          </Link>
        </div>
      </aside>
      {open && (
        <div
          className="fixed inset-0 z-30 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-72 bg-white">
            <button
              className="absolute right-3 top-4 p-1"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
            >
              <X size={20} />
            </button>
            <Brand />
            <Nav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-neutral-200 px-4 sm:px-8">
          <button
            className="p-1 lg:hidden"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
          >
            <Menu size={22} />
          </button>
          {!inWorkspace && (
            <form
              action="/workbooks"
              role="search"
              className="relative max-w-xl flex-1"
            >
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                aria-hidden
              />
              <input
                name="q"
                aria-label="Search workbooks"
                placeholder="Search your workbooks…"
                className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-neutral-950"
              />
            </form>
          )}
          <div className="relative ml-auto">
            <button
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-neutral-50"
            >
              <span className="grid size-9 place-items-center rounded-full bg-neutral-950 text-sm font-medium uppercase text-white">
                {name.slice(0, 2)}
              </span>
              <span className="hidden max-w-32 truncate text-sm sm:block">
                {name}
              </span>
              <ChevronDown size={14} />
            </button>
            {menu && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-20 w-64 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
              >
                <p className="truncate px-3 py-2 text-xs text-neutral-500">
                  {email}
                </p>
                <Link
                  role="menuitem"
                  href="/settings"
                  onClick={() => setMenu(false)}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-neutral-50"
                >
                  Settings
                </Link>
                <form action={signOutAction}>
                  <button
                    role="menuitem"
                    className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-neutral-50"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>
        <div className={inWorkspace ? "flex-1" : "flex-1 px-4 py-8 sm:px-8"}>
          {children}
        </div>
      </div>
    </div>
  );
}
