---
name: page-template-rules
description: The four non-negotiable SplitPageLayout left-column rules — leftTabs, fetcher, actions=buttons only, hidden prop
metadata:
  node_type: memory
  type: feedback
---

# SplitPageLayout left-column template rules

The left column of every page has four non-negotiable rules. In the original project these were corrected multiple times across pages; apply them from the start on every new manuHunter page. See [[copy-from-original-project]] and [[page-conventions]].

**Why:** the template is mandated. Deviating causes inconsistent UI and repeated correction work.

**How to apply:**
```tsx
<SplitPageLayout
  leftTabs={[{                 // always leftTabs, never left={<TabPanel .../>}
    label: 'List Name',
    actions: <IonButton ...>Action</IonButton>,   // buttons ONLY, no error text
    content: (
      <>
        {error && <IonText color="danger">...</IonText>}  // errors in content, not actions
        <ResourcePanel
          fetcher={fetchItems}          // always fetcher + refreshToken, never data={array}
          refreshToken={String(version)}
          config={PANEL_CONFIG.XYZ}
        />
      </>
    ),
  }]}
  hidden={<input ref={...} />}   // always-mounted invisible DOM goes in hidden
  ...
/>
```

The four rules, enforced together:
1. Always pass `leftTabs={[...]}`. Never `left={<TabPanel .../>}` or a bare `<ResourcePanel>`. `SplitPageLayout` renders the `TabPanel` internally. Use the `left: ReactNode` escape hatch only for a controlled TabPanel needing `activeTab`/`onTabChange` (rare).
2. `ResourcePanel` always uses `fetcher` + `refreshToken`. Never the `data={array}` prop.
3. `actions` is for buttons only. Error messages and non-interactive elements go inside `content`.
4. Hidden DOM nodes (file inputs, invisible refs, library TreeEditors) go in `SplitPageLayout`'s `hidden` prop.

`rightHeader` is an always-present zone (renders an empty bordered strip when undefined); use it only for page-level controls (bulk ops, mode toggles, save state), never to create a list item (that is `ResourcePanel`'s `onAdd`). Set `keepMounted` on a tab whose content holds a `useRef` other tabs access.
