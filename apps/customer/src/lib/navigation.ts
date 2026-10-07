import { router, type Href } from 'expo-router';

/** Finish a flow (e.g. checkout) and land on a tab with no half-finished screens behind it. */
export function finishFlowAt(href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}

/**
 * Where to go once someone has said where they are. During first-time setup the
 * next step is food preferences; when they came from the kitchen list, they go
 * back to it.
 */
export function afterPlaceChosen(then: string | undefined): void {
  if (then === 'discover') router.dismissTo('/discover');
  else router.push('/onboarding/preferences');
}
