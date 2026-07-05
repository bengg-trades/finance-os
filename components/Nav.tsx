"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Spending" },
  { href: "/trends", label: "Trends" },
  { href: "/review", label: "Review" },
  { href: "/upload", label: "Upload" },
];

// Bottom tab bar — phone is a primary surface for this app.
export default function Nav({ pendingCount }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-lg">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`relative flex-1 py-3 text-center text-sm font-medium ${
              pathname === l.href ? "text-neutral-900" : "text-neutral-400"
            }`}
          >
            {l.label}
            {l.href === "/review" && (pendingCount ?? 0) > 0 && (
              <span className="absolute -mt-1 ml-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
