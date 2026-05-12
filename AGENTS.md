# AGENTS.md — llm-usage-monitor

## Stack
- **Expo SDK 53** managed workflow (no native iOS/Android code)
- **React 19.0.0**, **React Native 0.79** with New Architecture enabled (default in SDK 53)
- **TypeScript ~5.8** (strict mode), no test framework, no CI
- **Bun** is the package manager (use `bun add`, `bun run`, `bun x`)

## Commands
```bash
bun run ts:check     # TypeScript type-checking (tsc --noEmit)
bun start            # expo start (dev server)
bun run android      # expo start --android
bun run ios          # expo start --ios
bun run web          # expo start --web
bun x expo install --check  # verify Expo package version compatibility
bun x expo install --fix    # auto-resolve Expo package versions
```

There is no lint, format, or test command configured.

## Architecture

```
src/
  types/      — All TypeScript interfaces (BalanceInfo, DailyUsage, AppSettings, etc.)
  theme/      — Dark theme tokens: colors, spacing, borderRadius, fontSize, shadows
  storage/    — Persistence: settings.ts (expo-secure-store), balanceHistory.ts (AsyncStorage)
  api/        — Provider plugin: index.ts (registry), deepseek.ts (sole implementation)
  hooks/      — React hooks: useBalance, useHistory, useSettings
  components/ — Pure presentational: BalanceCard, DailyUsageCard, UsageChart
  screens/    — Pages: DashboardScreen, HistoryScreen, SettingsScreen
  tasks/      — expo-background-fetch task definition
  notifications/ — expo-notifications setup + alert senders
```

**Data flow**: Screens → hooks → storage + api → background services

**3-tab navigation** (Dashboard, History, Settings) via `@react-navigation/bottom-tabs` v7.

## Path aliases
`@/*` → `src/*` (configured in `tsconfig.json`)

## Key conventions

### Two storage backends
- **`expo-secure-store`** — encrypted, for API key and user settings (`src/storage/settings.ts`)
- **`@react-native-async-storage/async-storage`** — unencrypted KV, for balance snapshot history (`src/storage/balanceHistory.ts`)

### Provider plugin pattern
`src/api/index.ts` is a registry (`Map<ProviderType, UsageProvider>`). To add a new LLM provider:
1. Implement the `UsageProvider` interface (defined in `src/types/index.ts`)
2. Register it in `src/api/index.ts`
Currently only `deepseek` is implemented.

### Mount-guard pattern
All hooks use `useRef(true)` + `isMounted.current` to prevent state updates after unmount. Follow this pattern for any new hook.

### Babel plugin order
`react-native-reanimated/plugin` must be **last** in the babel plugins array (already configured correctly).

### Dark theme only
`app.json` sets `"userInterfaceStyle": "dark"`. All visual tokens in `src/theme/index.ts`. Never introduce light-mode code paths.

### expo-background-fetch deprecated → migrate to expo-background-task
`expo-background-fetch` was **deprecated** in SDK 53 (iOS Background Fetch removed in iOS 13). Replacement is `expo-background-task` (`BGTaskScheduler`/`WorkManager`). The app still uses the legacy API — migrate when possible. Key differences: `minimumInterval` changes from seconds to **minutes**, `stopOnTerminate`/`startOnBoot` removed (automatic).

### Push notifications no longer in Expo Go for Android (SDK 53)
Requires a **development build** (`npx expo run:android`) for push notification testing on Android. iOS Expo Go still works.

### Edge-to-edge Android
SDK 53 enables edge-to-edge by default for new projects. Existing projects are opt-in via `app.json` (`expo.android.edgeToEdgeEnabled`). Not yet enabled in this project.

### Background fetch minimum interval
`expo-background-fetch` enforces a **15-minute minimum** interval. The `registerBackgroundFetch` function in `src/tasks/backgroundFetch.ts` silently clamps lower values.

### Balance history auto-pruning
`src/storage/balanceHistory.ts` auto-prunes snapshots older than 90 days on each `recordSnapshot()` call. `getDailyUsage()` defaults to 7 days, groups snapshots by calendar day, and computes daily cost as `max(0, first.balanceStart - last.balanceEnd)`.
