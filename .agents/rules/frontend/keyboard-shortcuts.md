# Keyboard shortcuts

- Every form submit and every primary action button (create, save, delete, and the main action of a page, sheet, or dialog) gets a keyboard shortcut. Bind it with `useHotkeys` from `react-hotkeys-hook`.
- Row-level icon buttons, menu items, and pagination controls are exempt.
- Show the shortcut on the button itself with `Kbd` (or `KbdGroup` for combos) from `@/components/ui/kbd`, so the binding is discoverable without docs.
- Scope the binding to where the button is visible: a sheet or dialog's shortcut is active only while it is open, and doesn't collide with page-level shortcuts.
- Don't hijack keys the browser or OS owns (e.g. `Mod+W`, `Mod+T`, plain typing keys while an input is focused).

Why: the app is driven keyboard-first, and a shortcut nobody can see is a shortcut nobody uses.
