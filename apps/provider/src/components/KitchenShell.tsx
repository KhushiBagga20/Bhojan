'use client';

import { ClipboardList, LogOut, Settings, Sun, Users, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSession } from '@/app/providers';
import { useKitchen, type Kitchen } from '@/lib/queries';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cx, ErrorState, Loading } from './ui';

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/plans', label: 'Plans', icon: ClipboardList },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const KitchenContext = createContext<Kitchen | null>(null);

/** The signed-in provider's kitchen. Only usable inside the kitchen pages. */
export function useCurrentKitchen(): Kitchen {
  const kitchen = useContext(KitchenContext);
  if (!kitchen) throw new Error('useCurrentKitchen must be used inside KitchenShell');
  return kitchen;
}

export function SetupNeeded() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className="font-display text-title">Almost ready</h1>
      <p>The dashboard needs to be connected to Supabase.</p>
      <ol className="list-decimal pl-6">
        <li>Copy apps/provider/.env.example to apps/provider/.env.local</li>
        <li>Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</li>
        <li>Restart: npm run provider</li>
      </ol>
    </main>
  );
}

export function KitchenShell({ children }: { children: ReactNode }) {
  const { session, initializing, signOut } = useSession();
  const kitchen = useKitchen();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (initializing) return;
    if (!session) router.replace('/login');
    else if (kitchen.isSuccess && !kitchen.data) router.replace('/onboarding');
  }, [initializing, session, kitchen.isSuccess, kitchen.data, router]);

  if (!isSupabaseConfigured) return <SetupNeeded />;
  if (initializing || !session || kitchen.isPending || (kitchen.isSuccess && !kitchen.data)) {
    return <Loading message="Opening your kitchen…" />;
  }
  if (kitchen.error) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <ErrorState error={kitchen.error} action="opening your kitchen" onRetry={() => kitchen.refetch()} />
      </main>
    );
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`) || (href === '/today' && pathname.startsWith('/orders'));

  return (
    <KitchenContext.Provider value={kitchen.data!}>
      <div className="flex min-h-dvh">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-surface focus:p-3"
        >
          Skip to main content
        </a>
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 border-r border-line bg-surface p-6 md:flex">
          <div className="flex flex-col gap-1">
            <p className="text-small font-bold uppercase tracking-wide text-primary">Bhojan for Kitchens</p>
            <p className="font-display text-heading">{kitchen.data!.business_name}</p>
            <p className="text-small text-ink-soft">
              {kitchen.data!.is_published ? 'Live: customers can order' : 'Not live yet'}
            </p>
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cx(
                  'flex min-h-12 items-center gap-3 rounded-md px-3 font-bold',
                  isActive(item.href) ? 'bg-primary-soft text-primary' : 'text-ink hover:bg-surface-sunken',
                )}
              >
                <item.icon aria-hidden className="size-6" />
                {item.label}
              </Link>
            ))}
          </nav>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
            className="mt-auto flex min-h-12 items-center gap-3 rounded-md px-3 font-bold text-ink-soft hover:bg-surface-sunken"
          >
            <LogOut aria-hidden className="size-6" />
            Sign out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:hidden">
            <p className="font-display text-body">{kitchen.data!.business_name}</p>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                router.replace('/login');
              }}
              className="flex min-h-12 items-center gap-2 rounded-md px-3 text-small font-bold text-ink-soft"
            >
              <LogOut aria-hidden className="size-5" />
              Sign out
            </button>
          </header>
          <main
            id="main"
            className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-28 md:px-8 md:py-10 md:pb-10"
          >
            {children}
          </main>
        </div>

        {/* Mobile bottom navigation */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cx(
                'flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.8125rem] font-bold',
                isActive(item.href) ? 'text-primary' : 'text-ink-soft',
              )}
            >
              <span
                className={cx(
                  'flex h-8 w-14 items-center justify-center rounded-full',
                  isActive(item.href) && 'bg-primary-soft',
                )}
              >
                <item.icon aria-hidden className="size-6" />
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </KitchenContext.Provider>
  );
}
