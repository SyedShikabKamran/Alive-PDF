# Contributing to Alive PDF

Thanks for contributing! This is a vanilla JS + Vite project — no framework, no build complexity.

## Project Structure

```
alive-pdf/
├── index.html              # Single HTML file — all UI markup
├── src/
│   ├── main.js             # All application logic (~1700 lines)
│   └── style.css           # All styles (~1600 lines)
├── public/
│   └── favicon.svg
├── .github/
│   └── workflows/
│       └── deploy.yml      # GitHub Pages auto-deploy workflow
├── vite.config.js          # Vite + PWA plugin config
└── package.json
```

## Architecture overview

| Concern | Approach |
|---|---|
| PDF rendering | [PDF.js 3.4.120](https://mozilla.github.io/pdf.js/) bundled via npm |
| PDF worker | `?url` import + `GlobalWorkerOptions.workerSrc` |
| Storage | IndexedDB for PDF bytes, localStorage for metadata + annotations |
| Virtual scroll | `IntersectionObserver` render + evict observers (keep ~5 pages in memory) |
| Viewer zoom | CSS `zoom` property (no re-render) |
| Editor zoom | Re-render at new scale, but skip if same PDF + zoom |
| Render queue | Max 3 concurrent PDF.js renders |
| State | Single `S` object, persisted via `saveMeta()` |
| Reading position | Keyed by content hash (`hashBytes`), not filename |

## State Object (`S`)

```js
const S = {
  pdf,           // Uint8Array — raw PDF bytes (not base64)
  pdfHash,       // stable hash of PDF for reading position key
  filename,      // original PDF filename
  wm,            // watermark text
  wmOpacity,     // 0.05 – 0.5
  wmAngle,       // -90 – 90 degrees
  wmOnPdf,       // bool
  zoom,          // 0.5 – 3.0
  hlSpeed,       // highlight animation speed (0.01 – 3.6 seconds)
  annotations,   // array of annotation objects
  theme,         // 'dark' | 'sepia' | 'light'
  novelTitle,    // metadata for reaction packs
  creator,       // metadata for reaction packs
};
```

## Annotation object

```js
{
  id,              // unique ID (timestamp string)
  page,            // page number (1-indexed)
  y0,              // top position (% of page height)
  h,               // height (% of page height)
  x0,              // left position (% of page width)
  x1,              // right position (% of page width)
  emojis,          // emoji string
  text,            // reaction text
  showHighlight,   // bool — show the colored box
  showFloat,       // bool — show the emoji bubble
  color,           // 'gold' | 'rose' | 'sky' | 'mint' | 'violet' | 'coral'
}
```

## Common contributions

### Add a new highlight color

1. **HTML** (`index.html`): Add a `.color-dot` button in the popover:
   ```html
   <button class="color-dot" data-color="yourcolor" title="Your color"></button>
   ```

2. **JS** (`main.js`): Add to `VALID_COLORS` set and the `COLOR_RGB` map in `setupDrawEvents`:
   ```js
   const COLOR_RGB = { ..., yourcolor: '123,45,67' };
   ```

3. **CSS** (`style.css`): Add color variables and rules:
   ```css
   --hl-yourcolor: #abc123;
   .viewer-ann[data-color="yourcolor"] { background: var(--hl-yourcolor); }
   .hl-color-dot[data-color="yourcolor"] { border-color: var(--hl-yourcolor); }
   ```

### Add a new toolbar button (viewer)

1. Add `<button>` in `#viewer-toolbar` in `index.html`
2. Add the element reference to the `E` object at the top of `main.js`
3. Wire up `addEventListener` in `setupEvents()`

### Add a new theme

1. Add a `.theme-dot` button in the viewer toolbar in `index.html`
2. Add a `body.theme-yourname` CSS block in `style.css` (copy sepia as a template)
3. No JS changes — `setTheme()` handles it generically

### Add a keyboard shortcut

1. In `setupEvents()`, find the global `keydown` handler for the viewer
2. Add your condition and call the handler
3. Update the shortcuts modal in `index.html` (the `#shortcuts-modal` content)

### Modify the annotation UI

1. Update `saveAnnotation()` in `main.js` to handle the new field
2. Update `renderHlList()` to display it in the sidebar
3. Update `addViewerAnns()` or `renderEditorAnns()` if the viewer/editor needs to show it
4. Update the popover in `index.html` if users need to input it

## Running locally

```bash
npm install
npm run dev
```

App opens at **http://localhost:5173**

## Testing

- Load a **multi-page Urdu PDF** (tests RTL, font rendering, page eviction)
- Test both **Editor** and **Reader** modes
- Check **DevTools Console** for errors
- Test **mobile** by resizing the viewport or using your phone

## Code style

- **Vanilla JS ES modules** — no TypeScript, no framework
- **Clear function names** — `verbNoun()` pattern (`renderPage`, `loadPDF`, `saveAnnotation`)
- **State mutations via `S` object** — always `S.field = value` then `saveMeta()`
- **Cached DOM refs** — cache in `E` object at startup, don't query in hot paths
- **Notifications** — `toast(message, 'success'|'error'|'info', durationMs)`

## Before opening a PR

- [ ] No new npm dependencies (prefer bundled libs or vanilla JS)
- [ ] Tested with a multi-page Urdu PDF
- [ ] No console errors (`DevTools` → **Console** tab)
- [ ] Existing annotations still load/display correctly
- [ ] Works in Chrome and Edge (and Firefox if you can test)
- [ ] If you added a feature: update `README.md` briefly

## Key files and their responsibilities

| File | Responsibility |
|------|---|
| `main.js` | All app logic: state, PDF load/render, annotations CRUD, events, zoom, navigation, sharing |
| `style.css` | All styles: layout, themes, animations, components, color system |
| `index.html` | All markup: nav, editor, viewer, toolbar, sidebar, dialogs |
| `vite.config.js` | Vite + PWA plugin config, GitHub Pages base path |

## Debugging tips

- **PDF not rendering?** Check browser console for PDF.js errors; verify PDF is a valid file
- **Annotations not showing?** Check that `S.annotations` is populated and `renderEditorAnns()` is called
- **Animation not smooth?** Check `--hl-speed` CSS variable and render frame rate in DevTools
- **Page jump on zoom?** Check scroll position preservation in `changeZoom()`
- **Text layer not selectable?** Verify `renderTextLayer()` API call in `renderPage()`

## Questions?

Open an [issue](https://github.com/username/alive-pdf/issues) or start a [discussion](https://github.com/username/alive-pdf/discussions).
