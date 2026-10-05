import { View } from 'react-native';
import { DIETARY_PREFERENCES, spacing, type DietaryPreference } from '@bhojan/shared';
import { ChoiceRow } from '@/components';

export function PreferenceChoices({
  value,
  onChange,
}: {
  value: DietaryPreference[];
  onChange: (next: DietaryPreference[]) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }} accessibilityLabel="Food preferences">
      {DIETARY_PREFERENCES.map((option) => {
        const selected = value.includes(option.value);
        return (
          <ChoiceRow
            key={option.value}
            kind="checkbox"
            label={option.label}
            selected={selected}
            onPress={() => onChange(selected ? value.filter((v) => v !== option.value) : [...value, option.value])}
          />
        );
      })}
    </View>
  );
}
