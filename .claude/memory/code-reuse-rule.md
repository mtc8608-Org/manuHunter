---
name: code-reuse-rule
description: Non-negotiable — always reuse the existing shell/form components; only create a new component for genuinely new behaviour that no prop can express
metadata:
  node_type: memory
  type: feedback
---

# Component reuse rule (non-negotiable)

Always reuse existing components. Only create a new component if you need genuinely new behaviour that cannot be expressed through a new prop. Inherited from the original project (see [[copy-from-original-project]]); manuHunter uses the same `pwa/src/components/` shell library.

**Why:** duplicating patterns inline (hand-rolled modals, bespoke list panels, custom edit forms) creates maintenance debt and diverges from the standard the app is built on. This applies even for "quick" additions or one-off pages.

**How to apply.** Before writing any new JSX:
1. Check the shell library first. If something covers the case, use it.
2. If it almost fits, add a prop to the existing component.
3. Only if the behaviour is fundamentally different do you create a new file.

Decision guide (the single right choice for each need):
- Split-layout page → `SplitPageLayout` (wraps IonPage, AppHeader, AreaShell, Grid). Never hand-roll that boilerplate.
- Tab bar on either column → `TabPanel` (always renders the segment bar, even for one tab).
- "Create item" button on a list → `onAdd` on `ResourcePanel`, always, without exception. Never via `rightHeader`.
- Page-level controls above the right column → `rightHeader` (bulk ops, mode toggles, save state), never for creating list items.
- Tab-specific buttons → `actions` on the relevant `TabDef`.
- Any modal → `ModalShell`. Never a bare `IonModal > IonHeader > IonToolbar` block.
- Empty/unselected state → `EmptyState`.
- Any DB-backed list (sidebar, tab, or modal) → `ResourcePanel` with `fetcher` + `refreshToken`.
- Pick one item from the DB in a modal → `ModalShell` + `ResourcePanel` (no `onDelete`/`onAdd`) + confirm button. Never `IonSelect`/`IonRadioGroup`/hand-rolled list.
- Tabular data from any source → `DataTable` (source-agnostic `fetcher`).
- Configurable DB-driven form → `FormRenderer` (`mode='app'` dot-path keys, `mode='survey'` UUID keys). Add/edit modals use seeded form trees fetched by UUID, never bespoke field-state + conditional JSX.
- Tree add/edit/delete/reorder → `TreeEditor`. Never hand-roll add/edit/delete modal logic in a page.
- Guard a route → `PrivateRoute` or `AdminRoute`.

See [[page-conventions]] and [[page-template-rules]] for how these are laid out inside a page file.
