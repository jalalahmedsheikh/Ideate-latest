# Settings Functionality Implementation

## Goal Description
Implement full functionality for the Settings screen items and enhance navigation behavior:
- Connect the Home tab tap to scroll the feed to top and refresh.
- Provide navigation and logic for Edit Profile, Change Password, Theme switching, Push Notifications toggle persistence, Content Filter configuration, Two‑Factor Auth toggle persistence, Clear Cache, Support & App Info screens, and Terms of Service / Privacy Policy navigation.
- Ensure state persistence where appropriate and maintain Material Design 3 styling.

## User Review Required
> [!IMPORTANT]
> Review the plan for theme management approach and storage location for cached data. Confirm the preferred method for persisting toggle states (e.g., using `SharedPreferences`).

## Open Questions
> [!WARNING]
> - **Theme Persistence:** Should we use a `ThemeProvider` with `Provider` or store the theme preference in `SharedPreferences`? Which approach aligns with existing app architecture?
> - **Cache Clearing:** What directories constitute the app cache? Should we clear temporary files in the app's `getTemporaryDirectory()` only, or also clear image caches?
> - **Support & App Info Screens:** Do you have existing design assets or content for these screens, or should we create placeholder pages?
> - **Change Password:** Is there an existing backend endpoint for password updates? If so, provide the API path; otherwise, we will stub the UI.

## Proposed Changes
---
### Navigation Home (Home tab tap handling)
- Modify `NavigationHome` to detect taps on the Home tab when already selected.
- Call `_feedKey.currentState?.scrollToTopAndRefresh();`.
- Add a tap gesture detector around the Home `BottomNavigationBarItem`.

---
### SettingsScreen Enhancements
- Replace placeholder callbacks with actual navigation and logic:
  - `Edit Profile` → navigate to `EditProfileScreen` (already existing).
  - `Change Password` → navigate to a new `ChangePasswordScreen` (create stub).
  - `Theme` → open a dialog or bottom sheet to select Light/Dark/System; store selection via `SharedPreferences` and notify a `ThemeProvider`.
  - `Push Notifications` → use a persisted boolean; toggle saves to `SharedPreferences`.
  - `Content Filter` → navigate to `ContentFilterScreen` (stub).
  - `Two‑Factor Auth` → persisted toggle, similarly stored.
  - `Clear Cache` → call a utility to delete temporary files; show confirmation dialog.
  - `Support` → navigate to `SupportScreen` (stub).
  - `App Info` → navigate to `AppInfoScreen` (stub).
  - `Terms of Service` & `Privacy Policy` → open webview or external URL.
- Refactor `_listTile` to accept optional `trailing` widget and handle null onTap safely.
- Ensure all icons use Material Design 3 icons.

---
### Persistence Utilities
- Add `lib/utils/preferences.dart` with helper methods for reading/writing boolean values using `SharedPreferences`.
- Add `lib/utils/cache_manager.dart` with `clearCache()` that deletes files in `getTemporaryDirectory()`.

---
### Theme Management
- Create `lib/providers/theme_provider.dart` extending `ChangeNotifier`.
- Load saved theme on app start, expose `ThemeMode get themeMode` and `void setTheme(ThemeMode mode)`.
- Wrap `MaterialApp` with `ChangeNotifierProvider<ThemeProvider>`.
- Apply `themeMode` to `MaterialApp`.

---
### New Screens (Stubs)
- `change_password_screen.dart`
- `content_filter_screen.dart`
- `support_screen.dart`
- `app_info_screen.dart`
- Each screen follows the existing design language (AppBar with back button, placeholder body).

---
### Updated Imports
- Update relevant files to import new providers and utils.

## Verification Plan
### Automated Tests
- Run `flutter test` to ensure no compilation errors.
- Verify that SettingsScreen loads without crashes.
- Test that toggles persist after app restart (manual verification).

### Manual Verification
- Launch app, open Settings, toggle Push Notifications and verify state persists.
- Change theme, observe UI updates across screens.
- Tap Clear Cache, confirm temporary files are removed.
- Tap Home tab twice, ensure feed scrolls to top and refreshes.
- Navigate to each new stub screen and confirm navigation works.
- Confirm Log Out still functions.
