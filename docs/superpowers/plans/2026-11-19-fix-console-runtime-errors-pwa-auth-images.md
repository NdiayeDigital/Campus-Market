# Fix Console Runtime Errors (PWA Install, Supabase Refresh Token 400, R2 404 Images) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate runtime console errors (PWA `beforeinstallprompt` banner timing, Supabase Auth `refresh_token` 400 Bad Request, and Cloudflare R2 404 image errors) through early event registration, clean auth token invalidation, and robust dual-tier storage fallbacks.

**Architecture:** 
1. **Early PWA Registration & Banner Coordination:** Register `beforeinstallprompt` immediately upon script evaluation rather than waiting for `window.load`, prevent duplicate overlays by coordinating the PWA install banner and Push Notification prompt, and expose programmatic install triggers.
2. **Auth Refresh Resilience:** Eliminate redundant and failing `refreshSession()` calls on unauthenticated visitors, cleanly purge expired or revoked refresh tokens with local signout on `invalid_grant` / 400 errors, and prevent recurring token refresh request loops.
3. **Dual-Tier Image Storage Fallback:** Equip all UI components (`ProductCard`, `ProductDetailModal`, `AnnouncementCarousel`, `PartnersSection`) with dual-tier fallback (`R2 CDN` -> `Supabase Storage` -> `Placeholder/Initials`) so missing CDN objects never crash or display broken images.

**Tech Stack:** Vanilla ES Modules, Vite, Tailwind CSS, Supabase JS Client, Cloudflare R2 / AWS S3 SDK, Service Worker & Web Push API.

**Spec:** System error log review and architectural audit of `beforeinstallpromptevent.prompt()`, `token?grant_type=refresh_token 400`, and `*.r2.dev/*.webp 404`.

## Global Constraints

- **Zero Hardcoded Secrets**: Keep all keys strictly in environment variables; no secrets in code.
- **Additive Migrations & Backward Compatibility**: Never break existing Supabase storage URLs or public production endpoints.
- **Production Safety**: Ensure no blocking UI crashes, infinite redirect/refresh loops, or unhandled promise rejections.
- **Test-Driven Verification**: Every task must end with automated tests confirming resolution and preventing regressions.

## Review Focus

1. **Unauthenticated Visitor Experience**: Visitors without accounts must never trigger `/auth/v1/token?grant_type=refresh_token` requests.
2. **Expired Session Invalidation**: Stale tokens must be purged from `localStorage` on first 400 response without looping or throwing alerts.
3. **CDN 404 Recovery**: If an image URL on Cloudflare R2 returns 404, the browser image element must immediately try the original Supabase Storage URL before falling back to `/assets/placeholder.webp`.
4. **PWA Prompt User Gesture**: `deferredPrompt.prompt()` must only be called in direct response to a user click gesture on the install button.
5. **Banner Non-Clustering**: The PWA install banner and Push notification prompt must never overlay or occlude each other on mobile or desktop viewports.

---

## Task Structure

### Task 1: Dual-Tier Image Storage Fallback & R2/Supabase Resilience

**Files:**
- Modify: `src/utils/image-compressor.js`
- Modify: `src/components/ProductCard.js`
- Modify: `src/components/ProductDetailModal.js`
- Modify: `src/components/AnnouncementCarousel.js`
- Modify: `src/components/PartnersSection.js`
- Modify: `src/components/seller/SellerProductQuotaModal.js`
- Test: `tests/test-image-fallback.js`

- [ ] **Step 1: Write test for dual-tier fallback utility**
  Create `tests/test-image-fallback.js` validating:
  - `resolveMediaUrl(url)` converts Supabase URLs to Cloudflare R2 URLs.
  - `getFallbackStorageUrl(url)` converts Cloudflare R2 URLs back to the origin Supabase Storage URL.
  - Non-R2 external URLs (e.g. Unsplash, placeholder) are returned intact.

- [ ] **Step 2: Implement fallback URL generator in `src/utils/image-compressor.js`**
  Add and export `getFallbackStorageUrl(url)`:
  ```javascript
  export function getFallbackStorageUrl(url) {
      if (!url || typeof url !== 'string') return '';
      const SUPABASE_STORAGE_PREFIX = 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/';
      const R2_PUBLIC_PREFIX = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/';
      if (url.startsWith(R2_PUBLIC_PREFIX)) {
          return url.replace(R2_PUBLIC_PREFIX, SUPABASE_STORAGE_PREFIX);
      }
      return url;
  }
  ```

- [ ] **Step 3: Update `ProductCard.js` with dual-tier image error handler**
  In `src/components/ProductCard.js`, update product `<img>` and seller avatar `<img>` tags:
  ```html
  <img 
      src="${escapeHTML(safeImageUrl)}" 
      alt="${escapeHTML(product.title)}"
      loading="lazy"
      decoding="async"
      class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
      onerror="
          if (this.dataset.fallbackTried !== 'true' && this.src.includes('pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev')) {
              this.dataset.fallbackTried = 'true';
              this.src = this.src.replace('https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/', 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/');
          } else {
              this.onerror = null;
              this.src = '/assets/placeholder.webp';
          }
      "
  >
  ```
  And for seller avatar:
  ```html
  onerror="
      if (this.dataset.fallbackTried !== 'true' && this.src.includes('pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev')) {
          this.dataset.fallbackTried = 'true';
          this.src = this.src.replace('https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/', 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/');
      } else {
          this.onerror = null;
          this.parentElement.textContent = '${(sellerName[0] || 'V').toUpperCase()}';
      }
  "
  ```

- [ ] **Step 4: Update `ProductDetailModal.js`, `AnnouncementCarousel.js`, and `PartnersSection.js`**
  Apply the same resilient dual-tier fallback pattern to modal gallery images, carousel slides, and partner logos.

- [ ] **Step 5: Run unit tests to confirm image fallback resilience**
  Run `node tests/test-image-fallback.js` and verify all tests pass.

---

### Task 2: Supabase Auth Session Resilience & Stale Token Invalidation

**Files:**
- Modify: `src/services/seller-service.js:380-420`
- Modify: `src/services/supabase.js`
- Test: `tests/test-auth-session-resilience.js`

- [ ] **Step 1: Write test for unauthenticated visit and stale token handling**
  Create `tests/test-auth-session-resilience.js` verifying that:
  - `getCurrentSeller()` does not call `supabase.auth.refreshSession()` when `getSession()` returns no user.
  - When a refresh error occurs (e.g. 400 `invalid_grant`), local storage session items (`campus_market_cached_seller`) and Supabase local session are cleaned without uncaught rejections.

- [ ] **Step 2: Refactor `getCurrentSeller()` in `src/services/seller-service.js`**
  Modify lines 383-395:
  ```javascript
  export async function getCurrentSeller() {
      try {
          const { data, error: sessionErr } = await supabase.auth.getSession();
          let session = data?.session;

          // Only attempt session refresh if a session object exists but user is missing, or if explicitly requested
          if (!session?.user && session?.refresh_token) {
              try {
                  const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
                  if (refreshData?.session?.user) {
                      session = refreshData.session;
                  } else if (refreshErr) {
                      // Stale or revoked token: purge local auth state immediately to avoid repeated 400 loops
                      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
                      if (typeof localStorage !== 'undefined') {
                          localStorage.removeItem('campus_market_cached_seller');
                      }
                      return null;
                  }
              } catch {
                  return null;
              }
          }
          if (!session?.user) return null;
  ```

- [ ] **Step 3: Add error guard to `supabase.js`**
  Ensure unexpected auth errors or token refresh failures on startup trigger clean local storage resets rather than uncaught network 400 loops.

- [ ] **Step 4: Run unit test to confirm auth resilience**
  Run `node tests/test-auth-session-resilience.js` and ensure 100% pass rate.

---

### Task 3: PWA Installation Prompt Lifecycle & Push Banner Deconfliction

**Files:**
- Modify: `src/utils/pwa-install.js`
- Modify: `src/utils/push-prompt.js`
- Modify: `src/main.js`
- Test: `tests/test-pwa-install.js`

- [ ] **Step 1: Enhance `pwa-install.js`**
  - Register `beforeinstallprompt` as soon as module is imported or when `initPwaInstallPrompt()` is called.
  - Expose helper functions:
    - `isInstallPromptAvailable()`: returns `boolean` indicating if `deferredPrompt` is ready.
    - `triggerPwaInstallPrompt()`: triggers `.prompt()` directly on user gesture.
    - `isPwaBannerVisible()`: returns whether the install banner is currently shown in the DOM.
  - Add coordinate notification event/flag when banner opens or closes.

- [ ] **Step 2: Deconflict Push Notification prompt in `src/utils/push-prompt.js`**
  - In `showPushPromptBanner()`:
    - If `isPwaBannerVisible()` is true, postpone push notification banner by 12 seconds so the two banners never overlap or compete for screen space.
    - If Push banner is closed or accepted, allow PWA install prompt.

- [ ] **Step 3: Move PWA initialization early in `src/main.js`**
  Move `initPwaInstallPrompt()` from inside `window.addEventListener('load', ...)` to execute immediately at main initialization time, ensuring Chrome's `beforeinstallprompt` event is captured before the `load` event finishes.

- [ ] **Step 4: Run tests on PWA install module**
  Run `node tests/test-pwa-install.js` to ensure zero regressions and proper lifecycle handling.

---

### Task 4: Full Suite Regression Verification & Production Build

**Files:**
- Test: All suites in `package.json`

- [ ] **Step 1: Run comprehensive test suite**
  Execute:
  `npm test`
  Confirm all tests pass cleanly.

- [ ] **Step 2: Run production build check**
  Execute:
  `npm run build`
  Verify Vite compiles with zero errors and clean output bundle.
