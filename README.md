# Alive PDF

> **The emotionally-reactive PDF reader.** Highlights sweep across the page, emojis float, reactions trigger at your marked passages. Fully offline. Shareable. Made for readers.

Built for Urdu novel lovers who share stories over WhatsApp and Telegram. Works for any PDF reader who wants their annotations to feel alive.

---

## ✨ What's different

- **Animated highlights** — Line highlights sweep in (RTL-correct) as you scroll past them
- **Floating reactions** — Emojis and text bubble up at marked passages
- **Shareable** — Export a reaction pack, send a link, friends import it on their copy
- **Completely offline** — No account, no backend, no cloud. Works fully in your browser
- **Urdu-first** — Beautiful Nastaliq rendering, right-to-left layout, full Unicode
- **Customizable** — 6 colors, adjustable animation speed, 3 themes
- **Open source** — MIT licensed. No tracking. No ads.

---

## 🚀 Try it live

**No install needed — just click:**

[https://github.com/SyedShikabKamran/Alive-PDF.git](https://syedshikabkamran.github.io/Alive-PDF/)

---

## 📖 How to use

### Step 1: Annotate (Editor mode)

1. Click **Annotate** tab
2. Upload a PDF (drag-and-drop or click to browse)
3. **Drag a rectangle** over any line you want to mark
4. In the popup:
   - Add emojis (or pick from quick-picks)
   - Add optional reaction text
   - Choose a color (gold, rose, sky, mint, violet, coral)
   - Toggle "Show highlight" / "Show reaction" on/off
5. Save

### Step 2: Read (Reader mode)

1. Click **Read** tab
2. Scroll through your PDF
3. **Watch:** As you pass each marked line:
   - The highlight sweeps in (animation speed adjustable: 0.5× → instant)
   - The emoji bubble floats up (if enabled)
4. Your **reading position auto-saves** per PDF

### Step 3: Share reactions

**Option A: URL link (no backend needed)**

- Click **⋯ More** → **Copy Share Link**
- Send over WhatsApp, Telegram, Discord, email
- Friend opens link → reactions auto-import onto their copy
- ✨ No file transfer. No server. Just a link.

**Option B: File (portable)**

- Click **⋯ More** → **Share Pack**
- Downloads a `.reactions.json` file
- Friends load it with **⋯ More** → **Load Pack**

---

## ⌨️ Keyboard shortcuts

| Key        | Action                             |
| ---------- | ---------------------------------- |
| `?` or `/` | Show shortcuts                     |
| `f` or `F` | Fullscreen (reader only)           |
| `t` or `T` | Cycle theme (dark / sepia / light) |
| `+` or `=` | Zoom in                            |
| `-` or `_` | Zoom out                           |
| `Esc`      | Close dialog                       |

---

## 🛠️ Local development

### Install

```bash
git clone https://github.com/username/alive-pdf.git
cd alive-pdf
npm install
```

### Run

```bash
npm run dev
```

Opens at **http://localhost:5173**

### Build for production

```bash
npm run build
```

Output: `dist/` folder (ready to deploy)

---

## 💾 Data & privacy

- **Your PDF**: Stored in IndexedDB (browser's local storage) — up to 50MB per browser
- **Your annotations**: All highlights, emojis, notes stored locally
- **Reading position**: Auto-saved per PDF
- **Settings**: Theme, zoom, animation speed saved locally

**Zero data leaves your browser.** Everything processes client-side. No tracking. No analytics. No ads.

---

## ✅ Features

**Editor**

- ✅ Drag-to-annotate
- ✅ 6 highlight colors
- ✅ Emoji + text reactions
- ✅ Custom watermark
- ✅ Zoom in/out (instant CSS zoom)
- ✅ Page navigation

**Reader**

- ✅ Animated highlight sweep (RTL-correct)
- ✅ Floating emoji reactions
- ✅ Configurable animation speed (0.5× to instant)
- ✅ Dark / sepia / light themes
- ✅ Fullscreen reading
- ✅ Auto-saved reading position
- ✅ Text selection & search (PDF text layer)
- ✅ Screen reader support

**Sharing**

- ✅ Reaction pack export/import
- ✅ URL-hash sharing (gzipped, no backend)
- ✅ Project export (PDF + annotations)
- ✅ Portable `.alivepdf` backup format

**Performance & Offline**

- ✅ Fully offline (all CDN deps bundled locally)
- ✅ Service worker PWA (installable on phone)
- ✅ Memory-efficient virtual scroll + canvas eviction
- ✅ Lazy-loaded fonts

---

## 🛣️ Roadmap

### Done (v1.0)

- ✅ Animated highlights, emoji reactions, reaction packs
- ✅ URL-hash sharing (CompressionStream gzip)
- ✅ Offline-first (bundled fonts + PDF.js + icons)
- ✅ PWA shell (installable)
- ✅ Text layer (searchable)

### v1.1 (Soon)

- EPUB support
- Full-text search
- Reading stats dashboard

### v2.0 (Future)

- Tauri desktop app (Windows, Mac, Linux)
- Cloud sync (opt-in)
- Community pack discovery (GitHub-hosted)
- AI-suggested emojis
- Social card generator ("share this passage")

---

## 🤝 Contributing

**Contributions are welcome**, especially from the Urdu reading community.

### How to contribute

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-idea`
3. Make your changes
4. Test: `npm run dev`
5. Commit: `git commit -m "Add your feature"`
6. Push: `git push origin feature/your-idea`
7. Open a pull request

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on code style and architecture.

---

## 📜 License

MIT © 2026 — use it, fork it, build on it.

---

## 💬 Community & support

- **Issues**: [GitHub Issues](https://github.com/username/alive-pdf/issues) for bugs
- **Discussions**: [GitHub Discussions](https://github.com/username/alive-pdf/discussions) for ideas
- **Share**: Use it in your reading groups — feedback from real readers drives development
**Happy reading. Let your highlights come alive.** 📖✨
