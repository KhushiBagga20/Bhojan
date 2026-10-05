import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { isValidPincode, spacing } from '@bhojan/shared';
import { FormField } from '@/components';
import { announce } from '@/lib/a11y';

export interface AddressValues {
  address_line: string;
  locality: string;
  city: string;
  pincode: string;
  instructions: string;
}

type Errors = Partial<Record<keyof AddressValues, string>>;

export function validateAddress(values: AddressValues): Errors {
  const errors: Errors = {};
  if (!values.address_line.trim()) errors.address_line = 'Please enter your house or flat number.';
  if (!values.locality.trim()) errors.locality = 'Please enter your area or locality.';
  if (!values.city.trim()) errors.city = 'Please enter your city.';
  if (!isValidPincode(values.pincode.replace(/\s/g, ''))) errors.pincode = 'PIN codes have 6 digits, like 110017.';
  return errors;
}

export function cleanAddress(values: AddressValues): AddressValues {
  return {
    address_line: values.address_line.trim(),
    locality: values.locality.trim(),
    city: values.city.trim(),
    pincode: values.pincode.replace(/\s/g, ''),
    instructions: values.instructions.trim(),
  };
}

export const EMPTY_ADDRESS: AddressValues = { address_line: '', locality: '', city: '', pincode: '', instructions: '' };

/**
 * Controlled address fields. The parent owns submit; call `form.submit()` to
 * validate. Forgiving: spaces in PIN codes are ignored, errors say how to fix it.
 */
export function useAddressForm(initial: AddressValues) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});

  return {
    values,
    errors,
    set: (field: keyof AddressValues, value: string) => {
      setValues((current) => ({ ...current, [field]: value }));
      if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
    },
    reset: (next: AddressValues) => setValues(next),
    /** Returns cleaned values, or null (and shows messages) if something needs fixing. */
    submit: (): AddressValues | null => {
      const found = validateAddress(values);
      setErrors(found);
      const count = Object.keys(found).length;
      if (count > 0) {
        announce(count === 1 ? 'One detail needs fixing.' : `${count} details need fixing.`);
        return null;
      }
      return cleanAddress(values);
    },
  };
}

export function AddressFields({ form }: { form: ReturnType<typeof useAddressForm> }) {
  const locality = useRef<TextInput>(null);
  const city = useRef<TextInput>(null);
  const pincode = useRef<TextInput>(null);
  const { values, errors, set } = form;

  return (
    <View style={{ gap: spacing.lg }}>
      <FormField
        label="House or flat number"
        hint="Include the building or floor, e.g. B-42, Second Floor"
        value={values.address_line}
        onChangeText={(text) => set('address_line', text)}
        error={errors.address_line}
        autoComplete="street-address"
        textContentType="streetAddressLine1"
        returnKeyType="next"
        onSubmitEditing={() => locality.current?.focus()}
      />
      <FormField
        ref={locality}
        label="Area or locality"
        hint="e.g. Malviya Nagar"
        value={values.locality}
        onChangeText={(text) => set('locality', text)}
        error={errors.locality}
        textContentType="sublocality"
        returnKeyType="next"
        onSubmitEditing={() => city.current?.focus()}
      />
      <FormField
        ref={city}
        label="City"
        value={values.city}
        onChangeText={(text) => set('city', text)}
        error={errors.city}
        textContentType="addressCity"
        autoComplete="postal-address-locality"
        returnKeyType="next"
        onSubmitEditing={() => pincode.current?.focus()}
      />
      <FormField
        ref={pincode}
        label="PIN code"
        hint="6 digits"
        value={values.pincode}
        onChangeText={(text) => set('pincode', text.replace(/[^\d\s]/g, ''))}
        error={errors.pincode}
        keyboardType="number-pad"
        textContentType="postalCode"
        autoComplete="postal-code"
        maxLength={7}
      />
      <FormField
        label="Note for the delivery person"
        optional
        hint='e.g. "Ring the bell twice" or "Leave with the guard"'
        value={values.instructions}
        onChangeText={(text) => set('instructions', text)}
        maxLength={200}
      />
    </View>
  );
}
