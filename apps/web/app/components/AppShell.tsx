'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LayoutDashboard, ArrowLeftRight, Tags } from 'lucide-react';
import AppNav from './AppNav';

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/settings', label: 'Categories', icon: Tags },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export default function AppShell({
  email,
  children,
}: {
  email?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <AppNav email={email} />
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 sm:py-8">{children}</main>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[var(--ef-bg)]/95 backdrop-blur-md border-t border-[var(--ef-border)]"
        aria-label="Mobile"
      >
        <div className="grid grid-cols-3 h-14">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-[var(--ef-accent-warm)]' : 'text-[var(--ef-muted)]'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
