# Daily Voice Notes & Task Planner (Next.js + Clerk)

This app now uses **Next.js App Router** and **Clerk** authentication.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
CLERK_SECRET_KEY=YOUR_SECRET_KEY
```

> Use real values from Clerk Dashboard → API Keys. Do not commit `.env.local`.

3. Run locally:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Clerk integration points

- `proxy.ts` uses `clerkMiddleware()`
- `app/layout.tsx` wraps the app in `<ClerkProvider>` and renders `<SignInButton>`, `<SignUpButton>`, and `<UserButton>`
- `app/page.tsx` shows app content only for signed-in users via `<SignedIn>` / `<SignedOut>`
