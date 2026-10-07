import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { pluralize } from '@bhojan/shared';
import { Divider, EmptyState, ErrorState, ListGroup, ListRow, LoadingState, Screen, Text } from '@/components';
import { useKitchenAreas } from '@/lib/api';
import { saveDraft } from '@/lib/draft';
import { afterPlaceChosen } from '@/lib/navigation';

/** For people who would rather not share their location: pick an area kitchens deliver to. */
export default function ChooseArea() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const areas = useKitchenAreas();

  const choose = async (area: string, city: string) => {
    await saveDraft({ place: { kind: 'area', area, city } });
    afterPlaceChosen(then);
  };

  return (
    <Screen
      back={{ fallback: '/onboarding/location' }}
      title="Choose your area"
      subtitle="These are the areas our home kitchens deliver to. Tap yours."
    >
      {areas.isPending ? (
        <LoadingState message="Loading areas…" />
      ) : areas.error ? (
        <ErrorState error={areas.error} action="loading the areas" onRetry={() => areas.refetch()} />
      ) : areas.data.length === 0 ? (
        <EmptyState
          icon="search"
          title="No kitchens have joined yet"
          message="New home kitchens join every week. Please look again soon."
        />
      ) : (
        <>
          <ListGroup>
            {areas.data.map((item, index) => (
              <View key={`${item.area}-${item.city}`}>
                {index > 0 ? <Divider /> : null}
                <ListRow
                  icon="location"
                  title={item.area}
                  subtitle={`${item.city} · ${pluralize(item.kitchens, 'kitchen')}`}
                  onPress={() => choose(item.area, item.city)}
                />
              </View>
            ))}
          </ListGroup>
          <Text variant="secondary" color="textSecondary">
            Can’t see your area? No kitchen delivers there yet. New kitchens join every week.
          </Text>
        </>
      )}
    </Screen>
  );
}
