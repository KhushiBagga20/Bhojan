'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { describeError } from '@bhojan/shared';
import { KitchenProfileForm } from '@/components/KitchenProfileForm';
import { SetupNeeded } from '@/components/KitchenShell';
import { Card, Loading } from '@/components/ui';
import { useCreateKitchen, useKitchen, useOwner } from '@/lib/queries';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useSession } from '../providers';

export default function Onboarding() {
  const { session, initializing, userId } = useSession();
  const router = useRouter();
  const kitchen = useKitchen();
  const owner = useOwner();
  const create = useCreateKitchen();

  useEffect(() => {
    if (!initializing && !session) router.replace('/login');
    if (kitchen.data) router.replace('/today');
  }, [initializing, session, kitchen.data, router]);

  if (!isSupabaseConfigured) return <SetupNeeded />;
  if (initializing || !session || kitchen.isPending || owner.isPending || kitchen.data) return <Loading />;

  const phone = owner.data?.phone ?? '';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-small font-bold uppercase tracking-wide text-primary">Bhojan for Kitchens</p>
        <h1 className="font-display text-title">Set up your kitchen</h1>
        <p className="text-ink-soft">
          Start with the basics. Next you’ll add your delivery times, a meal plan and your menu. Customers can’t see
          your kitchen until you choose to go live.
        </p>
      </div>
      <Card>
        <KitchenProfileForm
          initial={{
            owner_name: owner.data?.name ?? '',
            business_name: '',
            tagline: 'Home-style vegetarian meals',
            description: '',
            phone: phone ? phone.slice(-10) : '',
            city: '',
            service_areas: '',
            service_pincodes: '',
            diet_type: 'VEGETARIAN',
            dietary_options: [],
            skip_cutoff_hours: 3,
          }}
          submitLabel="Create my kitchen"
          saving={create.isPending}
          error={create.error ? describeError(create.error, 'creating your kitchen').message : null}
          onSubmit={async ({ owner_name, ...values }) => {
            if (owner_name) await supabase.from('users').update({ name: owner_name }).eq('id', userId!);
            create.mutate({ ...values, user_id: userId! }, { onSuccess: () => router.replace('/today') });
          }}
        />
      </Card>
    </main>
  );
}
