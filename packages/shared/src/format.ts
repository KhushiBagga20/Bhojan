// Formatting for money, phone numbers, names and addresses.
import type { AddressRow } from './domain.ts';

/** Indian digit grouping: 208000 -> "2,08,000". */
function groupIndian(n: number): string {
  const s = String(Math.trunc(Math.abs(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** "₹2,080". Whole rupees are shown without decimals. */
export function formatRupees(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const whole = Math.trunc(abs);
  const paise = Math.round((abs - whole) * 100);
  return `${sign}₹${groupIndian(whole)}${paise ? `.${String(paise).padStart(2, '0')}` : ''}`;
}

export function formatPaise(paise: number): string {
  return formatRupees(paise / 100);
}

/** Price of one meal in a plan, rounded to the rupee. */
export function pricePerMeal(priceRupees: number, meals: number): number {
  return Math.round(priceRupees / Math.max(meals, 1));
}

/**
 * Accepts what people actually type ("98100 00001", "+91 98100-00001",
 * "098100 00001") and returns E.164 ("+919810000001") or null if it is not a
 * valid Indian mobile number.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

/** "+91 98100 00001" from "919810000001" or "+919810000001". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return phone.startsWith('+') ? phone : `+${digits}`;
}

/** A tel: link that works on phones for any stored phone format. */
export function telLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `tel:+${digits.length === 10 ? `91${digits}` : digits}`;
}

/** "B-42, Second Floor, Malviya Nagar, New Delhi" (with the PIN code, for addresses saved with one). */
export function formatAddress(
  address: Pick<AddressRow, 'address_line' | 'locality' | 'city'> & { pincode?: string | null },
): string {
  return `${address.address_line}, ${address.locality}, ${address.city}${address.pincode ? ` ${address.pincode}` : ''}`;
}

/**
 * A distance the way people say it: "Less than 1 km away", "About 2.5 km away".
 * Distances from the server are already rounded to half a kilometre.
 */
export function formatDistance(km: number): string {
  if (km < 1) return 'Less than 1 km away';
  return `About ${Number.isInteger(km) ? km : km.toFixed(1)} km away`;
}

/** "Sharma ji" style dashboard greeting uses the first word; customers see the full name. */
export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
