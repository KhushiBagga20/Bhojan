import { textSizes, type TextSizePreference } from '@bhojan/shared';
import { Card, ChoiceGroup, ChoiceRow, Notice, Screen, SectionHeader, Text } from '@/components';
import { useTheme } from '@/theme';

const SIZE_LABELS: Record<TextSizePreference, string> = {
  standard: 'Standard',
  large: 'Large',
  extraLarge: 'Extra large',
};

export default function AccessibilitySettings() {
  const { textSize, setTextSize, appReduceMotion, setAppReduceMotion, systemReduceMotion } = useTheme();

  return (
    <Screen back title="Accessibility" subtitle="Changes apply straight away, everywhere in the app.">
      <SectionHeader title="Text size" />
      <ChoiceGroup label="Text size">
        {(Object.keys(textSizes) as TextSizePreference[]).map((size) => (
          <ChoiceRow
            key={size}
            label={SIZE_LABELS[size]}
            selected={textSize === size}
            onPress={() => setTextSize(size)}
          />
        ))}
      </ChoiceGroup>
      <Card tone="muted">
        <Text variant="secondary" color="textSecondary">
          Preview
        </Text>
        <Text variant="bodyStrong">Today's lunch: Dal, Roti, Aloo gobhi, Rice</Text>
        <Text variant="body">Expected between 12:30 – 1:00 PM</Text>
      </Card>
      <Text variant="secondary" color="textSecondary">
        Bhojan also follows the text size you set in your phone's settings.
      </Text>

      <SectionHeader title="Motion" />
      <ChoiceRow
        kind="checkbox"
        label="Reduce motion"
        description="Turns off sliding screens and animations."
        selected={appReduceMotion || systemReduceMotion}
        onPress={() => setAppReduceMotion(!appReduceMotion)}
      />
      {systemReduceMotion ? (
        <Notice
          tone="info"
          message="Reduce motion is switched on in your phone's settings, so animations are already off."
        />
      ) : null}
    </Screen>
  );
}
