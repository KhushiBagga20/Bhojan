import { router, type Href } from 'expo-router';

/** Finish a flow (e.g. checkout) and land on a tab with no half-finished screens behind it. */
export function finishFlowAt(href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
