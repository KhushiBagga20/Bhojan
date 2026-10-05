import type { ReactNode } from 'react';
import { KitchenShell } from '@/components/KitchenShell';

export default function KitchenLayout({ children }: { children: ReactNode }) {
  return <KitchenShell>{children}</KitchenShell>;
}
