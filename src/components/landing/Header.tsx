"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";

const links = [
  { href: "/", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-20 text-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-10">
          <Logo light />
          <nav
            className="hidden gap-7 text-sm text-neutral-300 md:flex"
            aria-label="Main"
          >
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/sign-in"
            className="text-sm text-neutral-200 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Get started free
          </Link>
        </div>
        <button
          className="md:hidden rounded-md p-2 hover:bg-white/10"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      {open && (
        <div
          id="mobile-menu"
          className="border-t border-white/10 bg-neutral-950 px-5 pb-5 md:hidden"
        >
          <nav className="flex flex-col py-2" aria-label="Mobile">
            {links.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-3 text-neutral-200"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="py-3 text-neutral-200"
            >
              Sign in
            </Link>
          </nav>
          <Link
            href="/sign-up"
            onClick={() => setOpen(false)}
            className="block rounded-full bg-white py-2.5 text-center text-sm font-medium text-neutral-950"
          >
            Get started free
          </Link>
        </div>
      )}
    </header>
  );
}
