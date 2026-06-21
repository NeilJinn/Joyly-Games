# design-sync notes — joyly-games-prototype

## Known validate warnings (benign)

- **[RENDER_THIN] NavBar**: `floating={false}` NavBar uses `position: fixed` in floating mode but `floating=false` puts it in normal flow. The validator's DOM measurement collapses fixed-positioned variants to the same hash. The review screenshots confirm both `SignedIn` (account chip + Play button) and `WithRoom` (Room 482901 · Cosmic Trivia pill + account chip) render distinctly. Grade: good.

## Preview patterns

- **Modal/AnimatePresence**: Components that use framer-motion `AnimatePresence` with `initial={{ opacity: 0 }}` cannot render to a static screenshot — the animation doesn't complete before the capture. Workaround: bypass the component wrapper and render the dialog content directly in a static panel container styled to match the component's visual (backdrop + panel). Affected: `Modal.tsx`, `AuthModal.tsx`, `GamePickerModal.tsx`, `PaymentModal.tsx`, `PromoRail.tsx`.

- **Auth store (`isSignedIn`)**: `useAuthStore` stores `isSignedIn` as a separate boolean field (not derived from `account`). When seeding auth via `__authStore.setState({...})` in previews, always include `isSignedIn: true` or the NavBar (and any other component that reads `isSignedIn` directly) will show the signed-out state even when `account` is set.

- **Zustand store sharing**: All preview cells in a sheet share the same Zustand store instance. Setting auth in one cell's `useEffect` propagates to ALL mounted components. Design cells to be auth-state-agnostic, or accept that only one auth state can be shown per sheet.

- **WebGL/Three.js animation components** (ConfettiRain, Joyly01Overlay, ScoreBurstOverlay, PhoneSadEmojiRain): Canvas shows blank in headless Playwright. Workaround: wrap with descriptive label text; the `cardMode: single` override keeps them as standalone cards.

- **`capture-review` 900ms settle wait**: Added `page.waitForTimeout(900)` after networkidle in `package-capture.mjs` review sheet capture. Required for framer-motion components that animate in (without this, content animated with `initial={{ opacity: 0 }}` is captured at t=0).
