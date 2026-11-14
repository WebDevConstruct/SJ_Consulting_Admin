"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  CreditCard,
  Home,
  LogOut,
  Menu,
  Newspaper,
  PenLine,
  User,
  Users,
  X,
} from "lucide-react";

import { BrandMark } from "./brand-mark";
import { createClient } from "@lib/supabase/client";
import { useAppContext } from "../../Context";
import type { usermetadata } from "@/types/admin-auth";
import type { Route } from "next";

const supabase = createClient();

const items = [
  {
    href: "/admin/home",
    label: "Home",
    icon: Home,
  },
  {
    href: "/admin/information",
    label: "Information",
    icon: Newspaper,
  },
  {
    href: "/admin/blogs",
    label: "Blog posts",
    icon: PenLine,
  },
  {
    href: "/admin/admission-data",
    label: "Admission data",
    icon: Users,
  },
  {
    href: "/admin/questions",
    label: "Questions",
    icon: BookOpen,
  },
  {
    href: "/admin/courses",
    label: "Courses",
    icon: BookOpen,
  },
  {
    href: "/admin/cbt-payments",
    label: "CBT payments",
    icon: CreditCard,
  },
  {
    href: "/admin/profile",
    label: "Profile",
    icon: User,
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { setUserAuthInfo } = useAppContext();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] =
    useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: "local" });

    setUserAuthInfo({} as usermetadata);

    router.replace("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile top bar */}
      <header className="fixed inset-x-0 top-0 z-50 mb-20 flex items-center justify-between border-b border-paper-line bg-paper/95 px-4 py-3 backdrop-blur md:hidden dark:border-ink-line dark:bg-ink-surface/95">
        <BrandMark />

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open admin navigation"
          className="rounded-xl border border-paper-line bg-paper p-2.5 text-ink dark:border-ink-line dark:bg-ink-soft dark:text-paper"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0  z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink/60"
          />

          <nav className="absolute inset-y-0 left-0  flex w-full flex-col border-r border-paper-line bg-paper dark:border-ink-line dark:bg-ink-surface">
            <div className="flex items-center justify-between border-b border-paper-line px-5 py-4 dark:border-ink-line">
              <BrandMark />

              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close admin navigation"
                className="rounded-xl border border-paper-line p-2.5 text-ink dark:border-ink-line dark:text-paper"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <ul className="flex flex-col gap-2">
                {items.map(
                  ({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;

                    return (
                      <li key={href}>
                        <Link
                          href={href as Route}
                          className={`flex items-center gap-4 rounded-2xl px-4 py-4 text-base font-bold transition ${
                            isActive
                              ? "bg-gold-100 text-gold-700 dark:bg-gold-700 dark:text-gold-100"
                              : "text-ink hover:bg-paper-surface dark:text-paper/75 dark:hover:bg-ink-line dark:hover:text-paper"
                          }`}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {label}
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>

            <div className="border-t border-paper-line p-4 dark:border-ink-line">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-base font-bold text-red-600 transition hover:bg-red-500/15 dark:text-red-400"
              >
                <LogOut className="h-5 w-5" />
                Logout
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-paper-line bg-paper transition-all duration-300 md:flex dark:border-ink-line dark:bg-ink-surface ${
          desktopCollapsed ? "w-20" : "w-[27%] max-w-[340px]"
        }`}
      >
        <div
          className={`flex items-center border-b border-paper-line px-4 py-5 dark:border-ink-line ${
            desktopCollapsed
              ? "justify-center"
              : "justify-between"
          }`}
        >
          {!desktopCollapsed && <BrandMark />}

          <button
            type="button"
            onClick={() =>
              setDesktopCollapsed(
                (previous) => !previous,
              )
            }
            aria-label={
              desktopCollapsed
                ? "Expand admin navigation"
                : "Collapse admin navigation"
            }
            className="rounded-xl border border-paper-line p-2.5 text-ink transition hover:bg-paper-surface dark:border-ink-line dark:text-paper dark:hover:bg-ink-line"
          >
            {desktopCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <ul className="flex flex-col gap-2">
            {items.map(
              ({ href, label, icon: Icon }) => {
                const isActive = pathname === href;

                return (
                  <li key={href}>
                    <Link
                      href={href as Route}
                      title={label}
                      className={`flex items-center rounded-2xl transition ${
                        desktopCollapsed
                          ? "justify-center p-3"
                          : "gap-3 px-4 py-3"
                      } ${
                        isActive
                          ? "bg-gold-100 text-gold-700 dark:bg-gold-700 dark:text-gold-100"
                          : "text-ink/60 hover:bg-paper-surface hover:text-ink dark:text-paper/60 dark:hover:bg-ink-line dark:hover:text-paper"
                      }`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />

                      {!desktopCollapsed && (
                        <span className="text-sm font-semibold">
                          {label}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        </nav>

        <div className="border-t border-paper-line p-3 dark:border-ink-line">
          <button
            type="button"
            onClick={handleSignOut}
            title="Logout"
            aria-label="Logout"
            className={`flex w-full items-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-600 transition hover:bg-red-500/15 dark:text-red-400 ${
              desktopCollapsed
                ? "justify-center p-3"
                : "justify-center gap-3 px-4 py-3"
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" />

            {!desktopCollapsed && (
              <span className="text-sm font-semibold">
                Logout
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}