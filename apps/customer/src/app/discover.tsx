import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors, dietaryLabel, pricePerMeal, spacing } from '@bhojan/shared';
import { Button, EmptyState, ErrorState, Icon, LoadingState, ProviderCard, Screen, Text } from '@/components';
import { useDeliveryContext } from '@/features/useDeliveryContext';
import { useProvidersNear, type ProviderCardData } from '@/lib/api';

/** Few enough choices to compare comfortably; more only if asked for. */
const FIRST_PAGE = 5;

function fromPrice(provider: ProviderCardData): number | null {
  const prices = provider.plans.filter((p) => p.is_active).map((p) => pricePerMeal(p.price_rupees, p.meals_count));
  return prices.length ? Math.min(...prices) : null;
}

function suits(provider: ProviderCardData, preferences: string[]): string[] {
  return preferences
    .filter((p) => (p === 'VEGETARIAN' ? provider.diet_type === 'VEGETARIAN' : provider.dietary_options.includes(p)))
    .map(dietaryLabel);
}

export default function Discover() {
  const context = useDeliveryContext();
  const providers = useProvidersNear(context.pincode);
  const [showAll, setShowAll] = useState(false);

  if (context.isPending) {
    return (
      <Screen back>
        <LoadingState />
      </Screen>
    );
  }
  if (!context.pincode) return <Redirect href="/onboarding/address" />;

  const list = providers.data ?? [];
  const visible = showAll ? list : list.slice(0, FIRST_PAGE);

  return (
    <Screen
      back={{ fallback: '/welcome' }}
      title="Tiffin services near you"
      onRefresh={() => providers.refetch()}
      refreshing={providers.isRefetching}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Icon name="location" size={24} color={colors.primary} />
        <Text variant="body" style={{ flex: 1 }}>
          {'Delivering to '}
          <Text variant="bodyStrong">{`${context.locality ?? ''} ${context.pincode}`.trim()}</Text>
        </Text>
      </View>
      <Button
        label="Change address"
        variant="secondary"
        icon="edit"
        onPress={() => router.push(context.editAddressHref)}
      />

      {providers.isPending ? (
        <LoadingState message="Finding kitchens near you…" />
      ) : providers.error ? (
        <ErrorState error={providers.error} action="finding kitchens" onRetry={() => providers.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="search"
          title={`No tiffin services deliver to ${context.pincode} yet`}
          message="We're adding new home kitchens every week. Please check your PIN code, or try again soon."
          actionLabel="Change PIN code"
          onAction={() => router.push(context.editAddressHref)}
        />
      ) : (
        <>
          <Text variant="body" color="textSecondary">
            {list.length === 1 ? '1 kitchen delivers to you.' : `${list.length} kitchens deliver to you.`}
          </Text>
          {visible.map((provider) => (
            <ProviderCard
              key={provider.id}
              name={provider.business_name}
              tagline={provider.tagline}
              dietType={provider.diet_type}
              rating={provider.rating}
              ratingCount={provider.rating_count}
              imageUrl={provider.cover_image_url}
              fromPrice={fromPrice(provider)}
              suits={suits(provider, context.preferences)}
              onView={() => router.push({ pathname: '/provider/[id]', params: { id: provider.id } })}
            />
          ))}
          {!showAll && list.length > FIRST_PAGE ? (
            <Button
              label={`Show ${list.length - FIRST_PAGE} more kitchens`}
              variant="secondary"
              icon="expand"
              onPress={() => setShowAll(true)}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}
