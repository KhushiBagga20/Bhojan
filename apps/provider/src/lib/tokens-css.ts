import { colors, radius, shadows } from '@bhojan/shared';

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/**
 * The shared design tokens as CSS custom properties. Injected once in the root
 * layout; Tailwind's theme (globals.css) points at these variables, so the
 * dashboard and the customer app always share one palette.
 */
export function tokensCss(): string {
  const vars = [
    ...Object.entries(colors).map(([name, value]) => `--bh-${kebab(name)}:${value}`),
    ...Object.entries(radius).map(([name, value]) => `--bh-radius-${name}:${value}px`),
    ...Object.entries(shadows).map(
      ([name, s]) => `--bh-shadow-${name}:0 ${s.offsetY}px ${s.radius}px rgba(59,42,30,${s.opacity})`,
    ),
  ];
  return `:root{${vars.join(';')}}`;
}
