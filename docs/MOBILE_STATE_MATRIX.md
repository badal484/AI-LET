# Mobile UX State Matrix

**Platform:** AI Companion Mobile (React Native CLI + TypeScript)  
**Date:** September 2026  
**Status:** Launch-Grade Production Matrix  

---

## 1. Overview

This matrix defines the expected UI, accessibility announcements, recovery actions, and data states for every screen in the AI Companion mobile client. Every visible screen supports 9 distinct operational states without unhandled exceptions or indefinite spinners.

---

## 2. Comprehensive Screen State Inventory

| Screen | Initial State | Loading State | Loaded / Success | Empty State | Error State | Offline Behavior | Permission Denied | Unauthorized / Expired | Deleted / Retired Content |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **Auth (Login/Register)** | Clean email/password form | Button spinner with disabled inputs | Smooth fade to home or onboarding | N/A | Inline red error text under inputs with actionable guidance | "Offline: Cannot verify credentials. Check connection." | N/A | Returns structured invalid credential banner | N/A |
| **Onboarding** | Welcome hero with value proposition | Step transition pulse | Step forms with selectable pills and active outlines | N/A | Recoverable step error banner with "Retry step" | Safe local persistence of step choices | Notification permission prompt with clear explanation | Session refresh or fallback to auth | N/A |
| **Home (Discover)** | ScreenContainer with top bar | Structured Skeleton cards matching feed sections | Dynamic editorial feed (Featured, Continue, Categories, Trending) | "No companions available right now" | Contextual `ErrorState` with "Retry" action | Cached feed displayed with subtle offline indicator | N/A | Automatic single-flight token refresh or logout | Automatically filtered out from active sections |
| **Search & Browse** | SearchInput focused with recent search chips | 3x `Skeleton.Card` horizontal loaders | Instant result list with genre and voice badges | `EmptyState` with spell correction ("Did you mean?") and genre chips | `ErrorState` with retry action | Cached recent searches accessible locally | N/A | Silent refresh or redirect to auth | Suppressed from live results |
| **Character Detail** | Hero image with header buttons | Full-height hero skeleton + card lines | Editorial profile with traits meters, starters, bio, voice CTA | N/A | Dignified `ErrorState`: "Companion Not Found" + "Go Back" | Cached bio and avatar with offline badge on Start Chat | Microphone permission explanation modal for voice | Redirect to login with character ID preserved | "This companion has been retired." |
| **Chat & Streaming** | Inverted message list with composer | 3x chat bubble skeletons | Streaming & history bubbles with timestamp and avatar | Character avatar with 3 clickable starter prompt pills | Banner with "Retry Sending" button | Read-only history with disabled send & offline banner | N/A | Single-flight refresh; message queued in local draft | "Companion unavailable" notice |
| **Voice Call** | Connecting avatar with pulse animation | Dynamic visualizer in "Connecting..." state | Full-duplex audio with real-time waveform & live subtitles | N/A | Red error badge with actionable reconnect button | "Call disconnected: Network lost" with reconnect CTA | Modal explaining microphone requirement + Settings link | Session token expiry prompts silent reconnect | Call terminates cleanly with explanation |
| **Paywall & Billing** | Value proposition hero with monthly/yearly toggle | Skeleton plan cards with price loader | Pro and Tier cards with feature checklists & trial terms | "No active plans found" fallback | Timeout recovery notice after 15s + retry prompt | "Offline: Connect to internet to purchase" | N/A | Prompts login before store receipt verification | N/A |
| **Credit Wallet** | Balance header with pack offerings | Shimmer placeholder for credit balance | Current balance + pack cards + promo redemption input | "No transaction history" | Promo code error inline; pack retry CTA | Cached balance displayed with "syncing" status | N/A | Prompts login | N/A |
| **Subscription Management** | Active tier overview with renewal date | Skeleton plan card | Current plan details, next billing date, tier upgrade/cancel actions | "No active paid subscription" with Upgrade CTA | Store sync error with "Restore Purchases" button | Cached tier state displayed | N/A | Prompts login | N/A |
| **Conversations List** | Chronological conversation list | 4x `Skeleton.Card` (72dp) placeholders | List with unread count badges, last snippets, and timestamps | `EmptyState`: "No Conversations Yet" + "Explore Companions" CTA | `ErrorState` with "Retry" button | Cached conversations accessible offline | N/A | Single-flight refresh | Auto-reconciled on next pull-to-refresh |
| **Notification Center** | Filterable category tabs (All, Messages, Reminders, etc.) | 3x notification card skeletons | Paginated notification cards with unread dots and delete actions | `EmptyState`: "No Notifications" | `ErrorState` with "Retry" button | Cached notifications viewable | Push notification permission prompt | Redirect to login | Deleted notification removed instantly |
| **Scheduled Reminders** | Reminders list grouped by upcoming vs completed | 2x card skeletons | Reminder cards with date, character attribution, and cancel action | `EmptyState`: "No Scheduled Reminders" | `ErrorState` with retry button | Cached reminders viewable | Local notification permission prompt | Redirect to login | Auto-deleted on companion retirement |
| **Memory Settings** | Category chips with search bar | 3x memory card skeletons | Filterable memory cards with category badges, Edit and Forget buttons | `EmptyState`: "No Memories Stored" or "No Matching Facts" | `ErrorState` with retry button | Read-only cached facts | N/A | Redirect to login | Cleanly omitted |
| **Personalization Settings** | Tone & pacing sliders with empathy presets | Loading spinner | Interactive sliders with live preview text | N/A | "Failed to save settings. Tap to retry." | Offline changes queued for sync | N/A | Redirect to login | N/A |
| **Notification Preferences** | Toggle list for quiet hours, lock-screen privacy, categories | Shimmer list | Functional switches with immediate optimistic persistence | N/A | Preference save error banner | Local toggle with background queue | System push permission status sync | Redirect to login | N/A |
| **Safety & Privacy** | Data controls, blocked users, export & deletion triggers | Loading indicator | Toggles, Blocked companions list with Unblock action | "No blocked companions" | Error banner with support link | Toggles disabled while offline | N/A | Redirect to login | N/A |
| **Creator Profile** | Creator hero banner with avatar and bio | Skeleton header + 2x character cards | Creator profile with follower stats, badge, and published companions | `EmptyState`: "No characters published yet." | `ErrorState`: "Creator Unavailable" + "Go Back" | Cached profile displayed | N/A | Redirect to login | N/A |

---

## 3. Global Exception & Boundary Handling

1. **Top-Level `ErrorBoundary`**: Wraps the entire navigation tree in `App.tsx`. Captures any unexpected React rendering lifecycle exceptions, displays a non-technical recovery card, and allows users to restart the session without native crash.
2. **Feature Error Boundaries**: Encapsulate high-risk asynchronous subsystems (Streaming Chat, WebRTC/WebSocket Voice, Object Storage Media Viewer). A failure in voice audio decoding isolates cleanly to the voice drawer without affecting the rest of the navigation stack.
3. **Single-Flight Refresh Mutex**: 401 Unauthorized API responses trigger a single centralized token refresh in `ApiClient`. All concurrent requests await the new token in a mutex queue, eliminating token rotation race conditions and unexpected logout loops.
4. **Network Reconnect Resilience**: The API client and WebSocket client automatically detect network reconnection and resynchronize authoritative state from PostgreSQL without duplicate message insertions.
