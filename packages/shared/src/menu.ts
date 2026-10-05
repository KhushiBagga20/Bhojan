// Which menu applies to a meal: a dated menu for that exact day wins, otherwise
// the weekly menu for that weekday. Always scoped to one kitchen, because a
// customer's menus list can hold several kitchens' menus.
import { addDays, isoWeekday, type ISODate } from './dates.ts';
import type { MealType, MenuItemRow, MenuRow } from './domain.ts';

export type MenuWithItems = MenuRow & { menu_items: MenuItemRow[] };

function withSortedItems(menu: MenuWithItems): MenuWithItems {
  return { ...menu, menu_items: [...menu.menu_items].sort((a, b) => a.sort_order - b.sort_order) };
}

export function resolveMenu(
  menus: readonly MenuWithItems[],
  providerId: string,
  date: ISODate,
  mealType: MealType,
): MenuWithItems | null {
  const own = menus.filter((m) => m.provider_id === providerId && m.meal_type === mealType);
  const dated = own.find((m) => m.menu_date === date);
  if (dated) return withSortedItems(dated);
  const weekly = own.find((m) => m.menu_date === null && m.day_of_week === isoWeekday(date));
  return weekly && weekly.menu_items.length > 0 ? withSortedItems(weekly) : null;
}

export function menuItemNames(menu: MenuWithItems | null): string[] {
  return menu ? menu.menu_items.map((item) => item.name) : [];
}

/** The first date from `from` (within `withinDays`) that has a menu for this meal. */
export function nextMenuDate(
  menus: readonly MenuWithItems[],
  providerId: string,
  from: ISODate,
  mealType: MealType,
  withinDays = 7,
): ISODate | null {
  for (let i = 0; i < withinDays; i++) {
    const day = addDays(from, i);
    if (resolveMenu(menus, providerId, day, mealType)) return day;
  }
  return null;
}

/** Weekly menus for one meal type as [weekday 1..7] -> items, for "This week's menu". */
export function weeklyMenu(
  menus: readonly MenuWithItems[],
  providerId: string,
  mealType: MealType,
): Array<{ day: number; items: string[] }> {
  return [1, 2, 3, 4, 5, 6, 7]
    .map((day) => {
      const menu = menus.find(
        (m) =>
          m.provider_id === providerId && m.meal_type === mealType && m.menu_date === null && m.day_of_week === day,
      );
      return { day, items: menu ? menuItemNames(withSortedItems(menu)) : [] };
    })
    .filter((entry) => entry.items.length > 0);
}
