'use client';

// Every read and write the dashboard makes. RLS on the server limits all of it
// to the signed-in provider's own kitchen and paying customers.
import type { QueryData } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  unwrap,
  type MealStatus,
  type MealType,
  type MenuWithItems,
  type TablesInsert,
  type TablesUpdate,
} from '@bhojan/shared';
import { useSession } from '@/app/providers';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Owner and kitchen
// ---------------------------------------------------------------------------
export function useOwner() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['owner', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await supabase.from('users').select('*').eq('id', userId!).single()),
  });
}

/** The signed-in user's kitchen, or null if they haven't created one yet. */
export function useKitchen() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['kitchen', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('provider_profiles').select('*').eq('user_id', userId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
export type Kitchen = NonNullable<ReturnType<typeof useKitchen>['data']>;

export function useCreateKitchen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<'provider_profiles'>) =>
      unwrap(await supabase.from('provider_profiles').insert(input).select().single()),
    onSuccess: () => client.invalidateQueries({ queryKey: ['kitchen'] }),
  });
}

export function useUpdateKitchen() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: TablesUpdate<'provider_profiles'> & { id: string }) =>
      unwrap(await supabase.from('provider_profiles').update(patch).eq('id', id).select().single()),
    onSuccess: () => client.invalidateQueries({ queryKey: ['kitchen'] }),
  });
}

// ---------------------------------------------------------------------------
// Delivery slots, plans, menus
// ---------------------------------------------------------------------------
export function useSlots(providerId: string | undefined) {
  return useQuery({
    queryKey: ['slots', providerId],
    enabled: !!providerId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('delivery_slots')
          .select('*')
          .eq('provider_id', providerId!)
          .order('meal_type')
          .order('start_time'),
      ),
  });
}

export function useSaveSlot() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<'delivery_slots'>) =>
      input.id
        ? unwrap(await supabase.from('delivery_slots').update(input).eq('id', input.id).select().single())
        : unwrap(await supabase.from('delivery_slots').insert(input).select().single()),
    onSuccess: () => client.invalidateQueries({ queryKey: ['slots'] }),
  });
}

export function usePlans(providerId: string | undefined) {
  return useQuery({
    queryKey: ['plans', providerId],
    enabled: !!providerId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('plans')
          .select('*, subscriptions(count)')
          .eq('provider_id', providerId!)
          .order('is_active', { ascending: false })
          .order('sort_order')
          .order('created_at'),
      ),
  });
}

export function useSavePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<'plans'>) =>
      input.id
        ? unwrap(await supabase.from('plans').update(input).eq('id', input.id).select().single())
        : unwrap(await supabase.from('plans').insert(input).select().single()),
    onSuccess: () => client.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useSetPlanActive() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) =>
      unwrap(await supabase.from('plans').update({ is_active: isActive }).eq('id', id).select().single()),
    onSuccess: () => client.invalidateQueries({ queryKey: ['plans'] }),
  });
}

export function useMenus(providerId: string | undefined) {
  return useQuery({
    queryKey: ['menus', providerId],
    enabled: !!providerId,
    queryFn: async () =>
      unwrap(await supabase.from('menus').select('*, menu_items(*)').eq('provider_id', providerId!)) as MenuWithItems[],
  });
}

function useInvalidateMenus() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['menus'] });
}

/** Adds a dish to the weekly menu for a day, creating that day's menu if needed. */
export function useAddMenuItem() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      mealType: MealType;
      dayOfWeek: number;
      name: string;
      menuId?: string;
      sortOrder: number;
    }) => {
      let menuId = input.menuId;
      if (!menuId) {
        const menu = unwrap(
          await supabase
            .from('menus')
            .insert({ provider_id: input.providerId, meal_type: input.mealType, day_of_week: input.dayOfWeek })
            .select('id')
            .single(),
        );
        menuId = menu.id;
      }
      return unwrap(
        await supabase
          .from('menu_items')
          .insert({ menu_id: menuId, provider_id: input.providerId, name: input.name, sort_order: input.sortOrder })
          .select()
          .single(),
      );
    },
    onSuccess: invalidate,
  });
}

export function useRenameMenuItem() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) =>
      unwrap(await supabase.from('menu_items').update({ name }).eq('id', id).select().single()),
    onSuccess: invalidate,
  });
}

export function useDeleteMenuItem() {
  const invalidate = useInvalidateMenus();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

export function useMenuFiles(providerId: string | undefined) {
  return useQuery({
    queryKey: ['menu-files', providerId],
    enabled: !!providerId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('menu_files')
          .select('*')
          .eq('provider_id', providerId!)
          .order('created_at', { ascending: false }),
      ),
  });
}

const ALLOWED_UPLOADS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Uploads a file into the kitchen's own storage folder and returns its public URL. */
export async function uploadKitchenFile(
  providerId: string,
  kind: 'menu' | 'cover',
  file: File,
): Promise<{ path: string; url: string }> {
  const ext = ALLOWED_UPLOADS[file.type];
  if (!ext) throw new Error('UNSUPPORTED_FILE');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('FILE_TOO_LARGE');
  const path = `${providerId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('provider-media').upload(path, file, { contentType: file.type });
  if (error) throw error;
  return { path, url: supabase.storage.from('provider-media').getPublicUrl(path).data.publicUrl };
}

export function useUploadMenuFile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, file }: { providerId: string; file: File }) => {
      const { path, url } = await uploadKitchenFile(providerId, 'menu', file);
      return unwrap(
        await supabase
          .from('menu_files')
          .insert({
            provider_id: providerId,
            storage_path: path,
            public_url: url,
            file_name: file.name,
            mime_type: file.type,
            size_bytes: file.size,
          })
          .select()
          .single(),
      );
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['menu-files'] }),
  });
}

export function useDeleteMenuFile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, storagePath }: { id: string; storagePath: string }) => {
      await supabase.storage.from('provider-media').remove([storagePath]);
      const { error } = await supabase.from('menu_files').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ['menu-files'] }),
  });
}

// ---------------------------------------------------------------------------
// Orders (meals) and customers
// ---------------------------------------------------------------------------
const ORDER_SELECT =
  '*, customer:users(id, name, phone, dietary_preferences), address:addresses(*), subscription:subscriptions(id, plan_name, plan_type, price_rupees, meals_total, status)';

const ordersQuery = (providerId: string, date: string) =>
  supabase
    .from('meal_orders')
    .select(ORDER_SELECT)
    .eq('provider_id', providerId)
    .eq('scheduled_date', date)
    .order('window_start')
    .order('created_at');
export type Order = QueryData<ReturnType<typeof ordersQuery>>[number];

export function useOrders(providerId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['orders', providerId, date],
    enabled: !!providerId,
    // Keep the kitchen view fresh while it's open.
    refetchInterval: 60_000,
    queryFn: async () => unwrap(await ordersQuery(providerId!, date)),
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['order', id],
    enabled: !!id,
    queryFn: async () => unwrap(await supabase.from('meal_orders').select(ORDER_SELECT).eq('id', id!).single()),
  });
}

export function useUpdateMealStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: MealStatus }) =>
      unwrap(await supabase.rpc('update_meal_status', { p_meal_ids: ids, p_status: status })),
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ['orders'] }),
        client.invalidateQueries({ queryKey: ['order'] }),
        client.invalidateQueries({ queryKey: ['customers'] }),
        client.invalidateQueries({ queryKey: ['customer'] }),
      ]),
  });
}

const customersQuery = (providerId: string) =>
  supabase
    .from('subscriptions')
    .select(
      '*, customer:users(id, name, phone, dietary_preferences), address:addresses(*), meal_orders(status, scheduled_date)',
    )
    .eq('provider_id', providerId)
    .not('activated_at', 'is', null)
    .order('activated_at', { ascending: false });
export type CustomerSubscription = QueryData<ReturnType<typeof customersQuery>>[number];

export function useCustomers(providerId: string | undefined) {
  return useQuery({
    queryKey: ['customers', providerId],
    enabled: !!providerId,
    queryFn: async () => unwrap(await customersQuery(providerId!)),
  });
}

export function useCustomerSubscription(id: string | undefined) {
  return useQuery({
    queryKey: ['customer', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('subscriptions')
          .select('*, customer:users(id, name, phone, dietary_preferences), address:addresses(*), meal_orders(*)')
          .eq('id', id!)
          .single(),
      ),
  });
}
