import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { colors, dietaryLabel, pricePerMeal, spacing } from '@bhojan/shared';
import { Button, EmptyState, ErrorState, Icon, LoadingState, ProviderCard, Screen, Text } from '@/components';
import { useDeliveryContext } from '@/features/useDeliveryContext';
import { useAppSettings, useKitchensNear, type NearbyKitchen } from '@/lib/api';

/** Few enough choices to compare comfortably; more only if asked for. */
const FIRST_PAGE = 5;

function fromPrice(kitchen: NearbyKitchen): number | null {
  const prices = kitchen.plans.filter((p) => p.is_active).map((p) => pricePerMeal(p.price_rupees, p.meals_count));
  return prices.length ? Math.min(...prices) : null;
}

function suits(kitchen: NearbyKitchen, preferences: string[]): string[] {
  return preferences
    .filter((p) => (p === 'VEGETARIAN' ? kitchen.diet_type === 'VEGETARIAN' : kitchen.dietary_options.includes(p)))
    .map(dietaryLabel);
}

export default function Discover() {
  const context = useDeliveryContext();
  const settings = useAppSettings();
  const kitchens = useKitchensNear(context.place);
  const [showAll, setShowAll] = useState(false);

  if (context.isPending) {
    return (
      <Screen back>
        <LoadingState />
      </Screen>
    );
  }
  const place = context.place;
  if (!place) return <Redirect href={{ pathname: '/onboarding/location', params: { then: 'discover' } }} />;

  const radius = settings.data?.delivery_radius_km ?? 10;
  const byDistance = place.kind === 'coords';
  // Where we are looking, in the person's own terms.
  const where = context.address
    ? `${context.address.label}, ${context.address.locality}`
    : byDistance
      ? 'where you are now'
      : place.area;
  const change = context.address
    ? { label: 'Change delivery address', go: () => router.push('/profile/address') }
    : {
        label: byDistance ? 'Update my location' : 'Look somewhere else',
        go: () => router.push({ pathname: '/onboarding/location', params: { then: 'discover' } }),
      };

  const list = kitchens.data ?? [];
  const visible = showAll ? list : list.slice(0, FIRST_PAGE);

  return (
    <Screen
      back={{ fallback: '/welcome' }}
      title="Tiffin services near you"
      onRefresh={() => kitchens.refetch()}
      refreshing={kitchens.isRefetching}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs }}>
        <Icon name="location" size={24} color={colors.primary} />
        <Text variant="body" style={{ flex: 1 }}>
          {byDistance ? `Home kitchens within ${radius} km of ` : 'Home kitchens that deliver to '}
          <Text variant="bodyStrong">{where}</Text>
        </Text>
      </View>
      <Button label={change.label} variant="secondary" icon="edit" onPress={change.go} />

      {kitchens.isPending ? (
        <LoadingState message="Finding kitchens near you…" />
      ) : kitchens.error ? (
        <ErrorState error={kitchens.error} action="finding kitchens" onRetry={() => kitchens.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon="search"
          title={byDistance ? `No kitchens within ${radius} km yet` : `No kitchens deliver to ${place.area} right now`}
          message="New home kitchens join every week. Please look again soon, or try another place."
          actionLabel={context.address ? 'Check my delivery address' : 'Look somewhere else'}
          onAction={change.go}
        />
      ) : (
        <>
          <Text variant="body" color="textSecondary">
            {`${list.length === 1 ? '1 kitchen' : `${list.length} kitchens`} can deliver to you. ${
              byDistance ? 'Nearest first.' : 'Best rated first.'
            }`}
          </Text>
          {visible.map((kitchen) => (
            <ProviderCard
              key={kitchen.id}
              name={kitchen.business_name}
              tagline={kitchen.tagline}
              dietType={kitchen.diet_type}
              rating={kitchen.rating}
              ratingCount={kitchen.rating_count}
              imageUrl={kitchen.cover_image_url}
              fromPrice={fromPrice(kitchen)}
              distanceKm={kitchen.distance_km}
              suits={suits(kitchen, context.preferences)}
              onView={() => router.push({ pathname: '/provider/[id]', params: { id: kitchen.id } })}
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
