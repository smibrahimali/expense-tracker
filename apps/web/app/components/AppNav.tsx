'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { createClient } from '../../utils/client';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/settings', label: 'Categories' },
];

function initialsFromEmail(email: string) {
  const local = email.split('@')[0] || 'U';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export default function AppNav({ email }: { email?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [userEmail, setUserEmail] = useState(email || '');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (email) {
      setUserEmail(email);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, [email, supabase]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-150 ${
        scrolled
          ? 'bg-[var(--ef-bg)]/90 backdrop-blur-md border-b border-[var(--ef-border)] shadow-[var(--ef-shadow-sm)]'
          : 'bg-[var(--ef-bg)]/70 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group shrink-0">
          <div className="w-8 h-8 rounded-[var(--ef-radius-sm)] bg-[var(--ef-accent)] text-white flex items-center justify-center shadow-[var(--ef-shadow-sm)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 9h4M7 13h2M13 13h4" />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[var(--ef-ink)] group-hover:text-[var(--ef-gray-600)] transition-colors">
            ExpenseFlow
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 p-0.5 rounded-[var(--ef-radius-sm)] bg-[var(--ef-gray-200)] border border-[var(--ef-border)]" aria-label="Main">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3.5 py-1.5 rounded-[6px] text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[var(--ef-accent-muted)] text-[var(--ef-accent-warm)] shadow-[var(--ef-shadow-sm)]'
                    : 'text-[var(--ef-gray-600)] hover:text-[var(--ef-ink)] hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-8 h-8 rounded-full bg-white/10 text-[var(--ef-ink)] text-[11px] font-semibold flex items-center justify-center hover:bg-white/15 transition-colors cursor-pointer border border-[var(--ef-border)]"
            aria-label="Account menu"
            aria-expanded={open}
          >
            {userEmail ? initialsFromEmail(userEmail) : '··'}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-60 bg-[var(--ef-surface-elevated)] rounded-[var(--ef-radius-md)] border border-[var(--ef-border)] shadow-[var(--ef-shadow-md)] z-50 overflow-hidden ef-animate-in">
              <div className="px-4 py-3 border-b border-[var(--ef-border)]">
                <p className="text-[11px] text-[var(--ef-muted)]">Signed in as</p>
                <p className="text-sm font-medium text-[var(--ef-gray-900)] truncate mt-0.5">
                  {userEmail || 'Loading…'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm font-medium text-[var(--ef-danger)] hover:bg-[var(--ef-danger-muted)] transition-colors flex items-center gap-2 cursor-pointer"
              >
                <LogOut size={16} strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
