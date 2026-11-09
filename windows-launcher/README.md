# SD | Калькулятор - Windows launcher prototype

This experimental branch contains a separate Windows portable launcher. It does not change the website, PWA, Android/iOS builds, or service worker.

## Behavior
- Prefers Google Chrome; falls back to Microsoft Edge.
- Opens the calculator as a standalone browser app window.
- Uses a per-Windows-session mutex so a second launcher start activates the existing calculator window instead of creating another one.
- The launcher exits after the app window is closed.

## Build
GitHub Actions builds a native Windows executable and uploads it as the artifact `SD-Calculator-Windows-Portable`. The executable is not published to the website.

## Rollback
Delete this experimental branch. The production branch remains unchanged.
