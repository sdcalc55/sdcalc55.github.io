# SD | Калькулятор - single-window PWA experiment

This branch tests the Chromium Web App Manifest `launch_handler` setting:

```json
"launch_handler": {
  "client_mode": "navigate-existing"
}
```

When the installed PWA is launched again, Chromium should reuse an existing app window rather than opening another one. Chrome and Edge both use Chromium, and no external launcher or extra browser process is added by this project.

The production branch and mobile installations are unchanged until this change is deliberately merged.

## Rollback
Revert the manifest change or discard this experimental branch.
