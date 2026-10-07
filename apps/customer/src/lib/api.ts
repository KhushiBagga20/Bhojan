// Every read and write the customer app makes, as React Query hooks. Row Level
// Security on the server decides what each person can see; these hooks only ask.
import type { QueryData } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, todayIST, unwrap, type DietaryPreference, type MenuWithItems } from '@bhojan/shared';
import type { Place } from './draft';
import { useSession } from './session';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Profile and addresses
// ---------------------------------------------------------------------------
export function useProfile() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await supabase.from('users').select('*').eq('id', userId!).single()),
  });
}

export function useUpdateProfile() {
  const { userId } = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name?: string; dietary_preferences?: DietaryPreference[] }) =>
      unwrap(await supabase.from('users').update(patch).eq('id', userId!).select().single()),
    onSuccess: (profile) => client.setQueryData(['profile', userId], profile),
  });
}

export function useAddresses() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['addresses', userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('addresses')
          .select('*')
          .eq('user_id', userId!)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true }),
      ),
  });
}

export interface AddressInput {
  id?: string;
  label?: string;
  address_line: string;
  locality: string;
  city: string;
  instructions?: string | null;
  /** Where the address is. Leave both out to keep what is already saved. */
  latitude?: number | null;
  longitude?: number | null;
}

export function useSaveAddress() {
  const { userId } = useSession();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AddressInput) => {
      if (id) {
        return unwrap(await supabase.from('addresses').update(input).eq('id', id).select().single());
      }
      return unwrap(
        await supabase
          .from('addresses')
          .insert({ ...input, user_id: userId!, label: input.label ?? 'Home', is_default: true })
          .select()
          .single(),
      );
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['addresses'] });
      client.invalidateQueries({ queryKey: ['providers'] });
      client.invalidateQueries({ queryKey: ['delivery-check'] });
    },
  });
}

export function useAppSettings() {
  return useQuery({
    queryKey: ['app-settings'],
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap(await supabase.from('app_settings').select('*').single()),
  });
}

// ---------------------------------------------------------------------------
// Catalog: kitchens, plans, menus (public data)
// ---------------------------------------------------------------------------
const providerCardQuery = () =>
  supabase
    .from('provider_profiles')
    .select(
      'id, business_name, tagline, diet_type, dietary_options, service_areas, rating, rating_count, cover_image_url, plans(price_rupees, meals_count, is_active)',
    );
export type ProviderCardData = QueryData<ReturnType<typeof providerCardQuery>>[number];

/** A kitchen on the discovery list. The distance is approximate, and absent when searching by area. */
export type NearbyKitchen = ProviderCardData & { distance_km: number | null };

/** Discovery needs the neighbourhood, not the doorstep: about 100 m is plenty for a 10 km search. */
const coarse = (degrees: number) => Math.round(degrees * 1000) / 1000;

/**
 * Kitchens for a place: within the delivery radius of a point (nearest first),
 * or delivering to a chosen area. The server decides who qualifies; the point is
 * only used for this search and is not stored.
 */
export function useKitchensNear(place: Place | undefined) {
  const key =
    place?.kind === 'coords'
      ? ['coords', coarse(place.latitude), coarse(place.longitude)]
      : ['area', place?.area.toLowerCase()];
  return useQuery({
    queryKey: ['providers', ...key],
    enabled: !!place,
    queryFn: async (): Promise<NearbyKitchen[]> => {
      const found =
        place!.kind === 'coords'
          ? unwrap(
              await supabase.rpc('kitchens_near', {
                p_latitude: coarse(place!.latitude),
                p_longitude: coarse(place!.longitude),
              }),
            )
          : unwrap(await supabase.rpc('kitchens_in_area', { p_area: place!.area })).map((row) => ({
              provider_id: row.provider_id,
              distance_km: null,
            }));
      if (found.length === 0) return [];
      const cards = unwrap(
        await providerCardQuery().in(
          'id',
          found.map((f) => f.provider_id),
        ),
      );
      const byId = new Map(cards.map((card) => [card.id, card]));
      // Keep the server's order: nearest first.
      return found.flatMap((f) => {
        const card = byId.get(f.provider_id);
        return card ? [{ ...card, distance_km: f.distance_km }] : [];
      });
    },
  });
}

/** The areas kitchens say they deliver to, for people who would rather not share their location. */
export function useKitchenAreas() {
  return useQuery({
    queryKey: ['kitchen-areas'],
    staleTime: 5 * 60_000,
    queryFn: async () => unwrap(await supabase.rpc('kitchen_areas')),
  });
}

export type DeliveryStatus = 'OK' | 'AREA_NOT_SERVED' | 'ADDRESS_NEEDS_LOCATION';

/** Whether a kitchen delivers to one of the person's own addresses, as decided by the server. */
export function useDeliveryCheck(providerId: string | undefined, addressId: string | undefined) {
  return useQuery({
    queryKey: ['delivery-check', providerId, addressId],
    enabled: !!providerId && !!addressId,
    queryFn: async () =>
      unwrap(
        await supabase.rpc('delivery_check', { p_provider_id: providerId!, p_address_id: addressId! }),
      ) as DeliveryStatus,
  });
}

const providerDetailQuery = (id: string) =>
  supabase
    .from('provider_profiles')
    .select('*, delivery_slots(*), plans(*), menus(*, menu_items(*)), menu_files(*)')
    .eq('id', id)
    .single();
export type ProviderDetail = QueryData<ReturnType<typeof providerDetailQuery>>;

export function useProvider(id: string | undefined) {
  return useQuery({
    queryKey: ['provider', id],
    enabled: !!id,
    queryFn: async () => unwrap(await providerDetailQuery(id!)),
  });
}

/** Menus for the kitchens a customer eats from, to show what's in each meal. */
export function useMenusFor(providerIds: string[]) {
  const ids = [...new Set(providerIds)].sort();
  return useQuery({
    queryKey: ['menus', ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () =>
      unwrap(await supabase.from('menus').select('*, menu_items(*)').in('provider_id', ids)) as MenuWithItems[],
  });
}

// ---------------------------------------------------------------------------
// Subscriptions (meal plans) and meals
// ---------------------------------------------------------------------------
const PROVIDER_CONTACT = 'id, business_name, phone, skip_cutoff_hours';

const subscriptionsQuery = (userId: string) =>
  supabase
    .from('subscriptions')
    .select(`*, provider:provider_profiles(${PROVIDER_CONTACT}), address:addresses(*)`)
    .eq('customer_id', userId)
    .not('activated_at', 'is', null)
    .order('created_at', { ascending: false });
export type SubscriptionWithDetails = QueryData<ReturnType<typeof subscriptionsQuery>>[number];

export function useMySubscriptions() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['subscriptions', userId],
    enabled: !!userId,
    queryFn: async () => unwrap(await subscriptionsQuery(userId!)),
  });
}

export function useSubscription(id: string | undefined) {
  return useQuery({
    queryKey: ['subscription', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('subscriptions')
          .select(`*, provider:provider_profiles(${PROVIDER_CONTACT}), address:addresses(*)`)
          .eq('id', id!)
          .single(),
      ),
  });
}

const mealsQuery = () =>
  supabase
    .from('meal_orders')
    .select(
      `*, subscription:subscriptions(id, plan_name, plan_type, status), provider:provider_profiles(${PROVIDER_CONTACT})`,
    );
export type MealWithDetails = QueryData<ReturnType<typeof mealsQuery>>[number];

/** Meals from a week ago to two months ahead. */
export function useMyMeals() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['meals', userId],
    enabled: !!userId,
    queryFn: async () => {
      const today = todayIST();
      return unwrap(
        await mealsQuery()
          .eq('customer_id', userId!)
          .gte('scheduled_date', addDays(today, -7))
          .lte('scheduled_date', addDays(today, 70))
          .order('scheduled_date')
          .order('window_start'),
      );
    },
  });
}

/** Every meal in one plan (for counts and the plan's upcoming list). */
export function useSubscriptionMeals(subscriptionId: string | undefined) {
  return useQuery({
    queryKey: ['meals', 'subscription', subscriptionId],
    enabled: !!subscriptionId,
    queryFn: async () =>
      unwrap(await mealsQuery().eq('subscription_id', subscriptionId!).order('scheduled_date').order('window_start')),
  });
}

export function useMeal(id: string | undefined) {
  return useQuery({
    queryKey: ['meal', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('meal_orders')
          .select(
            `*, subscription:subscriptions(id, plan_name, plan_type, status), provider:provider_profiles(${PROVIDER_CONTACT}), address:addresses(*)`,
          )
          .eq('id', id!)
          .single(),
      ),
  });
}

/** After any change to a plan or meal, refresh everything that shows them. */
function useInvalidateMealData() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['meals'] }),
      client.invalidateQueries({ queryKey: ['meal'] }),
      client.invalidateQueries({ queryKey: ['subscriptions'] }),
      client.invalidateQueries({ queryKey: ['subscription'] }),
    ]);
}

export function useSkipMeal() {
  const invalidate = useInvalidateMealData();
  return useMutation({
    mutationFn: async (mealId: string) => unwrap(await supabase.rpc('skip_meal', { p_meal_id: mealId })),
    onSuccess: invalidate,
  });
}

export function useUnskipMeal() {
  const invalidate = useInvalidateMealData();
  return useMutation({
    mutationFn: async (mealId: string) => unwrap(await supabase.rpc('unskip_meal', { p_meal_id: mealId })),
    onSuccess: invalidate,
  });
}

export function usePausePlan() {
  const invalidate = useInvalidateMealData();
  return useMutation({
    mutationFn: async (subscriptionId: string) =>
      unwrap(await supabase.rpc('pause_subscription', { p_subscription_id: subscriptionId })),
    onSuccess: invalidate,
  });
}

export function useResumePlan() {
  const invalidate = useInvalidateMealData();
  return useMutation({
    mutationFn: async (subscriptionId: string) =>
      unwrap(await supabase.rpc('resume_subscription', { p_subscription_id: subscriptionId })),
    onSuccess: invalidate,
  });
}

export function useCancelPlan() {
  const invalidate = useInvalidateMealData();
  return useMutation({
    mutationFn: async (subscriptionId: string) =>
      unwrap(await supabase.rpc('cancel_subscription', { p_subscription_id: subscriptionId })),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------
export function usePlan(planId: string | undefined) {
  return useQuery({
    queryKey: ['plan', planId],
    enabled: !!planId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('plans')
          .select('*, provider:provider_profiles(id, business_name, phone, delivery_slots(*))')
          .eq('id', planId!)
          .single(),
      ),
  });
}

export interface CheckoutInput {
  planId: string;
  addressId: string;
  startDate: string;
  slotId?: string;
}

export function useCreateSubscription() {
  return useMutation({
    mutationFn: async (input: CheckoutInput) =>
      unwrap(
        await supabase.rpc('create_subscription', {
          p_plan_id: input.planId,
          p_address_id: input.addressId,
          p_start_date: input.startDate,
          p_slot_id: input.slotId,
        }),
      ),
  });
}

export function usePayment(id: string | undefined) {
  return useQuery({
    queryKey: ['payment', id],
    enabled: !!id,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('payments')
          .select('*, subscription:subscriptions(*, provider:provider_profiles(business_name))')
          .eq('id', id!)
          .single(),
      ),
  });
}
export type PaymentWithSubscription = NonNullable<ReturnType<typeof usePayment>['data']>;

export function useMyPayments() {
  const { userId } = useSession();
  return useQuery({
    queryKey: ['payments', userId],
    enabled: !!userId,
    queryFn: async () =>
      unwrap(
        await supabase
          .from('payments')
          .select('*, subscription:subscriptions(plan_name, provider:provider_profiles(business_name))')
          .eq('user_id', userId!)
          .neq('status', 'CREATED')
          .order('created_at', { ascending: false })
          .limit(50),
      ),
  });
}

export function useInvalidateAfterPayment() {
  return useInvalidateMealData();
}
