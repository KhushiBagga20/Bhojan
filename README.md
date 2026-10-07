# Bhojan

Home-style tiffin meals from local kitchens, with an app that older adults find easy to use.

- **Customers** find a home kitchen near them, look at the menu, buy a single meal or a weekly/monthly plan, and then see, skip, pause or cancel their meals day by day.
- **Kitchens (providers)** set up their service, publish a weekly menu and plans, and work through each day's orders from a responsive web dashboard.

Design principle: *"I should never have to wonder what to tap next."*

---

## What's in the repo

```
apps/customer      Customer app: Expo SDK 57, React Native, Expo Router, TypeScript
apps/provider      Kitchen dashboard: Next.js 16 (App Router), Tailwind CSS 4, TypeScript
packages/shared    @bhojan/shared: design tokens, database types, dates (IST), money,
                   status labels, schedule rules, friendly error messages (+ unit tests)
supabase/
  migrations/      Schema, domain functions (RPCs), Row Level Security, storage, nightly job
  seed.sql         Four demo kitchens in South Delhi (with locations), menus and plans
  functions/       Edge functions: Razorpay order, verify, webhook
  tests/           SQL workflow + security tests that run on plain Postgres (no Docker)
  scripts/         gen-types.mjs: TypeScript types from the database
```

Both apps use the same backend (Supabase: Postgres, Auth, Storage, Edge Functions) and the same design tokens.

## How it works

### One subscription, many meals

Buying a plan creates a **subscription**. Once paid, the database generates one **meal_order** per delivery day (26 rows for a Monday–Saturday monthly plan). Every meal has its own status, so a customer can skip Tuesday and still get Wednesday.

- **Skip:** the meal becomes `SKIPPED` and a replacement is added after the last meal, so customers always get what they paid for. It can be undone until the cutoff.
- **Pause:** upcoming meals that can still be changed are removed (skipped days stay skipped). **Resume** reschedules the remaining meals from tomorrow.
- **Cancel:** every upcoming meal that can still be changed becomes `CANCELLED`.
- **Cutoff:** a meal can be changed until `skip_cutoff_hours` (set per kitchen, default 3) before its delivery window. Past the cutoff, the app says so and offers to call the kitchen.
- **Kitchen can't deliver:** the provider marks the meal `CANCELLED` and the customer gets a replacement at the end.
- **Nightly job** (`close_past_meals`, via pg_cron at 00:05 IST): marks yesterday's unconfirmed meals delivered, completes finished plans (`EXPIRED`, shown as "Completed"), and closes abandoned checkouts.

Meal statuses: `SCHEDULED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`, plus `SKIPPED` and `CANCELLED`. Subscription statuses: `PENDING_PAYMENT`, `ACTIVE`, `PAUSED`, `CANCELLED`, `EXPIRED`.

### Finding kitchens by location

Customers are shown the kitchens near them. Nobody is asked for a PIN code.

- **Customer:** taps *Use my current location* and allows it once. The app asks the server for published kitchens within `app_settings.delivery_radius_km` (10 km by default), nearest first. The point is used for that search only and is not stored. The first time they order, the location is saved with their delivery address.
- **No location?** If someone declines, or their device can't tell, they pick their area from the areas kitchens say they deliver to. Those kitchens are matched by area name instead.
- **Kitchen:** taps *Use my current location* once in **Settings → Kitchen location**, while in the kitchen. A kitchen cannot go live without it.
- **At checkout** the server applies the same rule again (`delivery_status`): within the radius when the address has a location, otherwise the kitchen must list the address's area. The checkout screen asks first (`delivery_check`) so the customer is told before paying.
- **Privacy:** a home kitchen is somebody's home, so its exact location lives in `provider_locations`, readable only by its owner. Everyone else only ever gets a distance rounded to half a kilometre from `kitchens_near`. A customer's address location is visible only to them and to the kitchen that cooks for them.
- **Where it works:** browsers only share location on `https://` or `localhost`. On a phone, use the Expo app (it asks through the phone's own permission prompt) or a deployed `https` site.

### Security

- **Row Level Security on every table.** Customers see only their own profile, addresses, subscriptions, meals and payments. Providers manage only their own catalog, and see only the paying customers, addresses and meals of their own kitchen. Published catalog data (kitchens, plans, menus) is public, so people can browse before signing up.
- **Clients never write subscriptions, meals or payments directly.** Every change goes through `SECURITY DEFINER` functions that check ownership and business rules: `create_subscription`, `skip_meal`, `unskip_meal`, `pause_subscription`, `resume_subscription`, `cancel_subscription`, `update_meal_status`. Prices always come from the plan on the server.
- **Column privileges:** customers can't change their role; providers can't set their own rating.
- **A kitchen can't go live** until it has a location, an active plan and a delivery time (enforced by a trigger).
- **Kitchen locations are private:** only the owner can read `provider_locations`; customers only get an approximate distance.
- **Storage:** providers can upload only into `provider-media/<their provider id>/…`.
- All of this is covered by `supabase/tests/01_workflow.test.sql`.

### Payments

The server decides the gateway (`app_settings.payment_mode`):

- **`TEST`** (default): no money moves. The pay screen activates the plan through `confirm_test_payment`, and can also simulate a declined payment. The server refuses test payments once the mode is `RAZORPAY`.
- **`RAZORPAY`:** `razorpay-create-order` creates an order from the payment row, Razorpay Checkout collects the payment (card and UPI details never reach Bhojan), and `razorpay-verify-payment` checks the signature before activating the plan. `razorpay-webhook` is the reliable fallback if the app closes mid-payment. On phones, Checkout opens in an in-app browser sheet, which works in Expo Go; a production build can swap in the native Razorpay SDK behind the same component.

A failed payment is recorded as `FAILED`, and the customer is told plainly: *"Your payment didn't go through. Your meal plan has not been activated."*

### Senior-first UX: what was built in

- Large type: page titles 28–32px (Fraunces serif), body 19px in **Atkinson Hyperlegible Next** (designed for low-vision readers), buttons 19px bold. Touch targets are at least 56px.
- Respects iOS Dynamic Type and Android font scaling (with sensible caps per style), plus an in-app **Text size** setting (Standard / Large / Extra large) in *Me → Accessibility*.
- **Reduce motion:** follows the phone setting, with an in-app toggle. Screen transitions and animations switch off.
- Statuses always show **an icon, a word and a colour**; colour is never the only signal. Food type uses the familiar green/brown veg marks, plus words.
- Every text pairing meets WCAG AA; most body text is above 7:1 (values documented in `packages/shared/src/tokens.ts`).
- Four tabs (Home, Meals, Plans, Me) with labels always visible. A labelled **Back** button on every inner screen. No icon-only critical actions, no hidden gestures (pull-to-refresh is only a bonus).
- Destructive actions (cancel plan, log out) ask first with explicit choices: "Yes, cancel my plan" / "No, keep my plan". Every action ends with a plain confirmation that is also read aloud to screen-reader users.
- Onboarding asks for the address and food preferences first and saves them on the phone. An account is requested only when the customer subscribes. Sign-in by SMS code (no password to remember) is built in; until an SMS provider is set up, the apps use email and password (see *Sign-in* below).
- Start dates are a short list of buttons ("Tomorrow (Wednesday, 30 September)"), not a calendar.
- Every screen has loading, empty and error states. Errors are sentences, never codes, for example *"You're offline right now. Please check your internet connection and try again."*
- Screen-reader labels, roles (header, button, radio, checkbox, alert) and states are set throughout.

---

## Getting started

### 1. Install

Requires Node 20 or newer.

```bash
npm install
```

### 2. Create the database

**Option A: hosted Supabase (recommended)**

1. Create a project at [supabase.com](https://supabase.com).
2. Apply the migrations, either with the CLI:

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

   or by pasting each file in `supabase/migrations/` (in order) into the SQL editor.
3. Optional demo data: paste `supabase/seed.sql` into the SQL editor.
4. Set up sign-in as described in **Sign-in** below.

**Option B: local Supabase** (needs Docker)

```bash
npx supabase start
```

This applies the migrations and seed. Test numbers `+91 99990 00001` and `+91 99990 00002` sign in with code `123456` (see `supabase/config.toml`).

### 3. Configure the apps

Copy `apps/customer/.env.example` to `apps/customer/.env.local` and `apps/provider/.env.example` to `apps/provider/.env.local`, then fill in the **Project URL** (`https://<project-ref>.supabase.co`) and the **publishable** (or legacy anon) key from *Project Settings → API*. The apps also accept the "REST URL" ending in `/rest/v1/`. Never put the service-role key in either app.

After changing `.env.local`, restart the dev server.

### Sign-in

The apps use **email + password** by default (`EXPO_PUBLIC_AUTH_METHOD` / `NEXT_PUBLIC_AUTH_METHOD`, default `password`), because SMS codes need a paid SMS provider. Customers also give their mobile number when they create an account, so kitchens can call them.

In Supabase: **Authentication → Sign In / Providers → Email**: keep it enabled and turn **off "Confirm email"**. Otherwise new accounts must click a link before signing in, and Supabase's built-in email sender only delivers to your team's addresses. There is no in-app password reset yet; reset a user's password from **Authentication → Users**.

To switch to SMS codes later (recommended for older customers: nothing to remember):
1. **Authentication → Sign In / Providers → Phone:** enable it and choose an SMS provider (Twilio, MessageBird, Textlocal or Vonage). Test numbers with fixed codes (for example `919999000001` → `123456`) work without sending SMS.
2. Set `EXPO_PUBLIC_AUTH_METHOD=otp` and `NEXT_PUBLIC_AUTH_METHOD=otp` in the `.env.local` files and restart. Kitchens can then also sign in with an email code; the *Magic Link* email template must include `{{ .Token }}`.

Accounts created with email + password are separate from accounts created later by phone code.

### 4. Run

```bash
npm run provider
```

The kitchen dashboard runs on http://localhost:3001.

```bash
npm run customer
```

This starts Expo. Scan the QR code with Expo Go, or press `i` / `a` for a simulator, or `w` for the browser.

### 5. Try the whole flow

1. **Kitchen:** sign in at http://localhost:3001, set up the kitchen, tap **Use my current location** under *Settings → Kitchen location*, add a delivery time, create a plan, add a weekly menu, then **Go live**.
2. **Customer:** open the app, tap *Find meals near me*, then *Use my current location* (within 10 km of the kitchen, so on the same computer is fine). Pick your kitchen, *Subscribe*, create an account, add your address, and pay (test mode).
3. The meals appear under **Meals**. Skip one, pause and resume the plan.
4. **Kitchen:** the new customer appears on **Today** / **Customers**. Mark meals as preparing, on the way, delivered. The customer sees each change.

### Switching on Razorpay

```bash
npx supabase secrets set RAZORPAY_KEY_ID=rzp_live_xxx RAZORPAY_KEY_SECRET=xxx RAZORPAY_WEBHOOK_SECRET=xxx
```

```bash
npx supabase functions deploy razorpay-create-order
```

```bash
npx supabase functions deploy razorpay-verify-payment
```

```bash
npx supabase functions deploy razorpay-webhook --no-verify-jwt
```

Then add a webhook in the Razorpay dashboard pointing to `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook` (events `payment.captured` and `payment.failed`), and switch the mode in the SQL editor:

```sql
update public.app_settings set payment_mode = 'RAZORPAY';
```

---

## Development

| Command | What it does |
| --- | --- |
| `npm run customer` / `npm run customer:web` | Start the Expo app (phone / browser) |
| `npm run provider` | Start the kitchen dashboard on port 3001 |
| `npm run db:test` | Build a throwaway `bhojan_test` database on a plain local Postgres and run the SQL workflow and security tests. Needs `psql`; creates the roles `anon`, `authenticated` and `service_role` on that server. |
| `npm run db:types` | Regenerate `packages/shared/src/database.types.ts` from `bhojan_test` (run `db:test` first) |
| `npm test` | Unit tests for the shared package |
| `npm run typecheck` | TypeScript across all workspaces |
| `npm run format` / `format:check` | Prettier |

The design tokens (colour, type, spacing, radius, touch targets, motion, shadows) live in `packages/shared/src/tokens.ts`. The customer app reads them directly. The dashboard turns them into CSS variables (`apps/provider/src/lib/tokens-css.ts`) that Tailwind's theme points at, so a change there updates both apps.

## Not in V1 (by design)

Live maps, AI features, chat, caregiver accounts, loyalty points, coupons, reviews, route optimisation, OCR of menu uploads, multiple delivery partners, analytics, multi-city infrastructure, a provider mobile app and social features are all out of scope. The schema leaves room for them.

Known limitations to address next:

- **Refunds** for cancelled meals are handled by the kitchen outside the app (the app says so).
- **Ratings** are set by an admin in SQL; there is no review system.
- **Updates** reach the customer on refresh and when the app returns to the foreground (the dashboard refreshes every minute). There are no push notifications yet.
- **Timezone:** single-timezone (IST) and English only. Dark mode is not implemented yet (colours are tokens, so it is a contained change).
