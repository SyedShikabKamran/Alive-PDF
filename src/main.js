// ============================================================
//  ALIVE PDF  |  main.js
// ============================================================

import './style.css';

// ── Bundled fonts + icons (self-hosted, no CDN) ─────────────
import '@fontsource/noto-nastaliq-urdu/arabic-400.css';
import '@fontsource/noto-nastaliq-urdu/arabic-600.css';
import '@fontsource/noto-nastaliq-urdu/arabic-700.css';
import '@fontsource/outfit/latin-300.css';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-500.css';
import '@fontsource/outfit/latin-600.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fortawesome/fontawesome-free/css/fontawesome.min.css';
import '@fortawesome/fontawesome-free/css/solid.min.css';

// ── PDF.js (bundled, worker via Vite ?url) ──────────────────
import * as pdfjsLib from 'pdfjs-dist/build/pdf.js';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ── State ────────────────────────────────────────────────────
const S = {
  pdf:         null,
  filename:    '',
  wm:          '',
  wmOpacity:   0.15,
  wmAngle:     -30,
  wmOnPdf:     true,
  zoom:        1,
  annotations: [],
  theme:       'dark',
  novelTitle:  '',
  creator:     '',
  hlSpeed:     1.8,
  pdfHash:     '',
};

let pdfDoc      = null;
let pendingColor = 'gold';
const draw      = { active: false, layer: null, page: null, startY: 0, startX: 0, box: null };
let pendingRect = null;
const triggered = new Set();
const floatBubbles = new Map(); // annId → span el

// ── DOM refs ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const E = {
  // nav
  btnEditor:         $('btn-editor'),
  btnViewer:         $('btn-viewer'),
  btnMore:           $('btn-more'),
  moreMenu:          $('more-menu'),
  btnExport:         $('btn-export'),
  btnImport:         $('btn-import'),
  importFile:        $('import-file'),
  btnShareLink:      $('btn-share-link'),
  btnExportPack:     $('btn-export-pack'),
  btnImportPack:     $('btn-import-pack'),
  importPackFile:    $('import-pack-file'),
  firstUseOverlay:   $('first-use-overlay'),
  annDots:           $('ann-dots'),

  // editor
  editorScreen:      $('editor-screen'),
  dropzone:          $('dropzone'),
  pdfFile:           $('pdf-file'),
  pdfStatus:         $('pdf-status'),
  pdfName:           $('pdf-name'),
  editorEmpty:       $('editor-empty'),
  editorScroll:      $('editor-scroll'),
  hlList:            $('highlights-list'),

  // pack info
  novelTitleInput:   $('novel-title-input'),
  creatorInput:      $('creator-input'),

  // watermark
  wmText:            $('f-watermark'),
  wmOpacity:         $('wm-opacity'),
  wmOpacityVal:      $('wm-opacity-val'),
  wmAngle:           $('wm-angle'),
  wmAngleVal:        $('wm-angle-val'),

  // editor toolbar
  jumpInput:         $('jump-input'),
  zoomLabel:         $('zoom-label'),        // now an <input>
  pageTotalEditor:   $('page-total-editor'),
  btnZoomIn:         $('btn-zoom-in'),
  btnZoomOut:        $('btn-zoom-out'),
  btnShortcuts:      $('btn-shortcuts'),
  btnPrevPage:       $('btn-prev-page'),
  btnNextPage:       $('btn-next-page'),
  vBtnPrevPage:      $('vbtn-prev-page'),
  vBtnNextPage:      $('vbtn-next-page'),

  // viewer
  viewerScreen:      $('viewer-screen'),
  viewerToolbar:     $('viewer-toolbar'),
  vBtnZoomOut:       $('vbtn-zoom-out'),
  vBtnZoomIn:        $('vbtn-zoom-in'),
  viewerZoomLabel:   $('viewer-zoom-label'), // now an <input>
  viewerPageInput:   $('viewer-page-input'),
  viewerPageTotal:   $('viewer-page-total'),
  vBtnFullscreen:    $('vbtn-fullscreen'),
  vBtnShortcuts:     $('vbtn-shortcuts'),
  readingArea:       $('reading-area'),
  viewerScroll:      $('viewer-scroll'),
  emojiLayer:        $('emoji-layer'),
  viewerEmpty:       $('viewer-empty'),
  btnGoEditor:       $('btn-go-editor'),

  // popover
  popover:           $('popover'),
  emojiInput:        $('emoji-input'),
  floatTextInput:    $('float-text-input'),
  popShowHl:         $('pop-show-hl'),
  popShowFloat:      $('pop-show-float'),
  btnPopSave:        $('btn-pop-save'),
  btnPopCancel:      $('btn-pop-cancel'),
  btnResetHl:        $('btn-reset-highlights'),

  // shortcuts modal
  shortcutsModal:    $('shortcuts-modal'),
  btnCloseShortcuts: $('btn-close-shortcuts'),

  // highlight speed
  hlSpeedSelect:     $('hl-speed-select'),
};

// ════════════════════════════════════════════════════════════
//  INDEXEDDB
// ════════════════════════════════════════════════════════════
const DB = (() => {
  let _db = null;
  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((ok, fail) => {
      const req = indexedDB.open('alivepdf_v1', 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore('blobs');
      req.onsuccess  = e => { _db = e.target.result; ok(_db); };
      req.onerror    = () => fail(req.error);
    });
  }
  async function set(key, val) {
    const db = await open();
    return new Promise((ok, fail) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').put(val, key);
      tx.oncomplete = ok;
      tx.onerror    = () => fail(tx.error);
    });
  }
  async function get(key) {
    const db = await open();
    return new Promise((ok, fail) => {
      const tx  = db.transaction('blobs', 'readonly');
      const req = tx.objectStore('blobs').get(key);
      req.onsuccess = () => ok(req.result ?? null);
      req.onerror   = () => fail(req.error);
    });
  }
  async function del(key) {
    const db = await open();
    return new Promise((ok, fail) => {
      const tx = db.transaction('blobs', 'readwrite');
      tx.objectStore('blobs').delete(key);
      tx.oncomplete = ok;
      tx.onerror    = () => fail(tx.error);
    });
  }
  return { set, get, del };
})();

// ════════════════════════════════════════════════════════════
//  PERSISTENCE
// ════════════════════════════════════════════════════════════
function saveMeta() {
  const { pdf, ...meta } = S;
  try { localStorage.setItem('apdf_state', JSON.stringify(meta)); } catch {}
}

function saveReadingPos() {
  // Key by content hash, not filename — two novels named "novel.pdf" no longer collide
  const key = S.pdfHash || S.filename;
  if (!key) return;
  try {
    localStorage.setItem('apdf_rpos_' + key, String(E.viewerScroll.scrollTop));
  } catch {}
}

function getReadingPos() {
  const key = S.pdfHash || S.filename;
  if (!key) return 0;
  try { return parseInt(localStorage.getItem('apdf_rpos_' + key)) || 0; } catch { return 0; }
}

async function loadSaved() {
  try {
    const raw = localStorage.getItem('apdf_state');
    if (raw) {
      const saved = JSON.parse(raw);
      // Whitelist fields that may be loaded from localStorage
      const strKeys  = ['filename','wm','theme','novelTitle','creator'];
      const numKeys  = ['wmOpacity','wmAngle','zoom','hlSpeed'];
      const boolKeys = ['wmOnPdf'];
      for (const k of strKeys)  { if (k in saved && typeof saved[k] === 'string')  S[k] = saved[k].slice(0, 500); }
      for (const k of numKeys)  { if (k in saved && typeof saved[k] === 'number' && isFinite(saved[k])) S[k] = saved[k]; }
      for (const k of boolKeys) { if (k in saved && typeof saved[k] === 'boolean') S[k] = saved[k]; }
      // Clamp numeric fields to valid ranges
      S.wmOpacity = clamp(S.wmOpacity, 0.05, 0.5);
      S.wmAngle   = clamp(S.wmAngle,   -90,  90);
      S.zoom      = clamp(S.zoom,       0.5,   3);
      S.hlSpeed   = clamp(S.hlSpeed,    0.01, 3.6);
      if (Array.isArray(saved.annotations)) {
        S.annotations = sanitizeAnnotations(saved.annotations);
      }
    }
  } catch {}

  let pdf = await DB.get('pdf');
  // Migrate legacy base64-string storage → raw bytes
  if (typeof pdf === 'string') {
    try { pdf = toUint8Array(pdf); await DB.set('pdf', pdf); } catch { pdf = null; }
  } else if (pdf instanceof ArrayBuffer) {
    pdf = new Uint8Array(pdf);
  }
  if (pdf) { S.pdf = pdf; S.pdfHash = hashBytes(pdf); }

  syncUIFromState();

  if (S.pdf) {
    E.pdfName.textContent      = S.filename;
    E.pdfStatus.style.display  = 'flex';
    E.editorEmpty.style.display = 'none';
    await loadPDF(true);
  }
  renderHlList();
}

function applyHlSpeed(s) {
  S.hlSpeed = clamp(+s, 0.01, 3.6);
  document.documentElement.style.setProperty('--hl-speed', S.hlSpeed + 's');
  if (E.hlSpeedSelect) {
    // snap select to nearest option value
    const opts = [...E.hlSpeedSelect.options].map(o => +o.value);
    const nearest = opts.reduce((a, b) => Math.abs(b - S.hlSpeed) < Math.abs(a - S.hlSpeed) ? b : a);
    E.hlSpeedSelect.value = String(nearest);
  }
}

function syncUIFromState() {
  E.wmText.value             = S.wm;
  E.wmOpacity.value          = S.wmOpacity;
  E.wmOpacityVal.textContent = S.wmOpacity;
  E.wmAngle.value            = S.wmAngle;
  E.wmAngleVal.textContent   = S.wmAngle + '°';
  E.novelTitleInput.value    = S.novelTitle;
  E.creatorInput.value       = S.creator;

  const zPct = Math.round(S.zoom * 100) + '%';
  E.zoomLabel.value             = zPct;
  E.viewerZoomLabel.value       = zPct;

  applyHlSpeed(S.hlSpeed);
  setTheme(S.theme || 'dark');
}

// ════════════════════════════════════════════════════════════
//  THEME
// ════════════════════════════════════════════════════════════
const THEMES = ['dark', 'sepia', 'light'];

function setTheme(theme) {
  if (!THEMES.includes(theme)) theme = 'dark';
  document.body.className = 'theme-' + theme;
  S.theme = theme;
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function cycleTheme() {
  const idx = THEMES.indexOf(S.theme);
  setTheme(THEMES[(idx + 1) % THEMES.length]);
  saveMeta();
}

// ════════════════════════════════════════════════════════════
//  FULLSCREEN
// ════════════════════════════════════════════════════════════
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const icon = E.vBtnFullscreen && E.vBtnFullscreen.querySelector('i');
  if (icon) {
    icon.className = document.fullscreenElement ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
  }
});

// ════════════════════════════════════════════════════════════
//  FOCUS TRAP  (keyboard accessibility for modal + popover)
// ════════════════════════════════════════════════════════════
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
let _trapCleanup = null;
let _lastFocus   = null;

function trapFocus(container) {
  releaseFocus();                       // only one trap at a time
  _lastFocus = document.activeElement;
  const onKey = e => {
    if (e.key !== 'Tab') return;
    const nodes = [...container.querySelectorAll(FOCUSABLE)].filter(n => n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  container.addEventListener('keydown', onKey);
  _trapCleanup = () => container.removeEventListener('keydown', onKey);
}
function releaseFocus() {
  if (_trapCleanup) { _trapCleanup(); _trapCleanup = null; }
  if (_lastFocus && _lastFocus.focus) { try { _lastFocus.focus(); } catch {} }
  _lastFocus = null;
}

// ════════════════════════════════════════════════════════════
//  SHORTCUTS MODAL
// ════════════════════════════════════════════════════════════
function openShortcuts() {
  E.shortcutsModal.classList.add('open');
  E.btnCloseShortcuts?.focus();
  trapFocus(E.shortcutsModal);
}
function closeShortcuts() {
  const wasOpen = E.shortcutsModal.classList.contains('open');
  E.shortcutsModal.classList.remove('open');
  if (wasOpen) releaseFocus();
}

// ════════════════════════════════════════════════════════════
//  EVENTS
// ════════════════════════════════════════════════════════════
function setupEvents() {
  // a11y: label icon/symbol-only buttons from their title; mark dialogs
  document.querySelectorAll('button[title]').forEach(b => {
    if (!b.getAttribute('aria-label') && !/[a-zA-Z؀-ۿ]/.test(b.textContent)) {
      b.setAttribute('aria-label', b.title);
    }
  });
  E.shortcutsModal?.setAttribute('role', 'dialog');
  E.shortcutsModal?.setAttribute('aria-modal', 'true');
  E.popover?.setAttribute('role', 'dialog');
  E.popover?.setAttribute('aria-modal', 'true');

  // nav
  E.btnEditor.addEventListener('click',   () => switchView('editor'));
  E.btnViewer.addEventListener('click',   () => switchView('viewer'));
  E.btnGoEditor.addEventListener('click', () => switchView('editor'));

  // ⋯ More dropdown — toggle on button, close on outside click
  E.btnMore.addEventListener('click', e => {
    e.stopPropagation();
    E.moreMenu.hidden = !E.moreMenu.hidden;
  });
  document.addEventListener('click', () => { E.moreMenu.hidden = true; });

  // first-use overlay
  if (!localStorage.getItem('apdf_seen')) {
    E.firstUseOverlay.style.display = 'flex';
    $('btn-first-use-ok').addEventListener('click', () => {
      E.firstUseOverlay.style.display = 'none';
      localStorage.setItem('apdf_seen', '1');
    });
  } else {
    E.firstUseOverlay.style.display = 'none';
  }

  // export / import project
  E.btnExport.addEventListener('click', exportProject);
  E.btnImport.addEventListener('click', () => E.importFile.click());
  E.importFile.addEventListener('change', importProject);

  // export / import pack
  E.btnExportPack.addEventListener('click', exportPack);
  E.btnImportPack.addEventListener('click', () => E.importPackFile.click());
  E.importPackFile.addEventListener('change', importPack);

  // copy shareable reactions link
  if (E.btnShareLink) E.btnShareLink.addEventListener('click', shareReactionsLink);

  // PDF upload — guard against synthetic click bubbling back from the file input
  E.dropzone.addEventListener('click', e => {
    if (e.target === E.pdfFile) return;
    E.pdfFile.click();
  });
  E.pdfFile.addEventListener('change', e => { const f = e.target.files[0]; if (f) readPDF(f); });
  setupDragDrop();

  // pack info
  E.novelTitleInput.addEventListener('input', e => { S.novelTitle = e.target.value.trim(); saveMeta(); });
  E.creatorInput.addEventListener('input',    e => { S.creator    = e.target.value.trim(); saveMeta(); });

  // metadata
  E.wmText.addEventListener('input', e => { S.wm = e.target.value; saveMeta(); });

  // watermark sliders
  E.wmOpacity.addEventListener('input', e => {
    S.wmOpacity = parseFloat(e.target.value);
    E.wmOpacityVal.textContent = S.wmOpacity;
    saveMeta();
  });
  E.wmAngle.addEventListener('input', e => {
    S.wmAngle = parseInt(e.target.value);
    E.wmAngleVal.textContent = S.wmAngle + '°';
    saveMeta();
  });

  // zoom buttons
  E.btnZoomIn.addEventListener('click',   () => changeZoom(0.15));
  E.btnZoomOut.addEventListener('click',  () => changeZoom(-0.15));
  E.vBtnZoomIn.addEventListener('click',  () => changeZoom(0.15));
  E.vBtnZoomOut.addEventListener('click', () => changeZoom(-0.15));

  // custom zoom input (type "150%" or "150" then Enter)
  function applyZoomInput(input) {
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) setZoom(val / 100);
  }
  E.zoomLabel.addEventListener('keydown', e => { if (e.key === 'Enter') { applyZoomInput(E.zoomLabel); E.zoomLabel.blur(); } });
  E.zoomLabel.addEventListener('blur', () => applyZoomInput(E.zoomLabel));
  E.viewerZoomLabel.addEventListener('keydown', e => { if (e.key === 'Enter') { applyZoomInput(E.viewerZoomLabel); E.viewerZoomLabel.blur(); } });
  E.viewerZoomLabel.addEventListener('blur', () => applyZoomInput(E.viewerZoomLabel));

  // prev / next page
  function scrollToPage(pageNum, scrollEl) {
    const ph = scrollEl.querySelector('[data-page="' + pageNum + '"]');
    if (ph) ph.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function currentPageIn(scrollEl) { return getVisiblePage(scrollEl) || 1; }

  E.btnPrevPage.addEventListener('click', () => {
    const p = currentPageIn(E.editorScroll); if (p > 1) scrollToPage(p - 1, E.editorScroll);
  });
  E.btnNextPage.addEventListener('click', () => {
    const p = currentPageIn(E.editorScroll); if (pdfDoc && p < pdfDoc.numPages) scrollToPage(p + 1, E.editorScroll);
  });
  E.vBtnPrevPage.addEventListener('click', () => {
    const p = currentPageIn(E.viewerScroll); if (p > 1) scrollToPage(p - 1, E.viewerScroll);
  });
  E.vBtnNextPage.addEventListener('click', () => {
    const p = currentPageIn(E.viewerScroll); if (pdfDoc && p < pdfDoc.numPages) scrollToPage(p + 1, E.viewerScroll);
  });

  // editor page jump (Enter in input; no dedicated button)
  E.jumpInput.addEventListener('keydown', e => { if (e.key === 'Enter') jumpToPage(); });

  // viewer page go (Enter in input)
  E.viewerPageInput.addEventListener('keydown', e => { if (e.key === 'Enter') viewerGoPage(); });

  // editor scroll — update page badge only (rAF-throttled)
  let _editorScrollTick = false;
  E.editorScroll.addEventListener('scroll', function() {
    if (!_editorScrollTick) {
      _editorScrollTick = true;
      requestAnimationFrame(function() {
        _editorScrollTick = false;
        updatePageBadge();
      });
    }
  }, { passive: true });

  // highlight speed select
  if (E.hlSpeedSelect) {
    E.hlSpeedSelect.addEventListener('change', function() {
      applyHlSpeed(this.value);
      saveMeta();
    });
  }

  // viewer scroll — rAF-throttled; localStorage write debounced (was: all 4 per event)
  let _scrollTick = false;
  let _savePosTimer = null;
  E.viewerScroll.addEventListener('scroll', function() {
    if (!_scrollTick) {
      _scrollTick = true;
      requestAnimationFrame(function() {
        _scrollTick = false;
        checkTriggers();
        updateReadingProgress();
        updatePageBadge();
      });
    }
    clearTimeout(_savePosTimer);
    _savePosTimer = setTimeout(saveReadingPos, 300); // ponytail: 300ms idle debounce, fine for resume-position
  }, { passive: true });

  // theme dots
  document.querySelectorAll('.theme-dot').forEach(btn => {
    btn.addEventListener('click', () => { setTheme(btn.dataset.theme); saveMeta(); });
  });

  // fullscreen
  E.vBtnFullscreen.addEventListener('click', toggleFullscreen);

  // shortcuts modal
  E.btnShortcuts.addEventListener('click',   openShortcuts);
  E.vBtnShortcuts.addEventListener('click',  openShortcuts);
  E.btnCloseShortcuts.addEventListener('click', closeShortcuts);
  E.shortcutsModal.addEventListener('click', e => {
    if (e.target === E.shortcutsModal) closeShortcuts();
  });

  // popover color picker
  document.querySelectorAll('.color-dot').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      pendingColor = btn.dataset.color;
    });
  });

  // popover
  E.btnPopSave.addEventListener('click',   saveAnnotation);
  E.btnPopCancel.addEventListener('click', closePopover);
  E.emojiInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveAnnotation(); });
  document.querySelectorAll('.ep').forEach(btn => {
    btn.addEventListener('click', () => { E.emojiInput.value += btn.textContent; });
  });

  // reset all highlights
  E.btnResetHl.addEventListener('click', clearAllAnnotations);

  // Global draw mouse handlers — registered ONCE here, not per-page in setupDrawEvents
  document.addEventListener('mousemove', onDrawMove);
  document.addEventListener('mouseup',   onDrawUp);

  // keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
      closePopover();
      closeShortcuts();
      return;
    }
    if (e.key === '?' || e.key === '/') { openShortcuts(); return; }
    if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); return; }
    if (e.key === 't' || e.key === 'T') { cycleTheme(); return; }
    if (e.key === '+' || e.key === '=') changeZoom(0.15);
    if (e.key === '-' || e.key === '_') changeZoom(-0.15);
  });
}

// ════════════════════════════════════════════════════════════
//  DRAG & DROP
// ════════════════════════════════════════════════════════════
function setupDragDrop() {
  const dz = E.dropzone;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('over');
    const f = e.dataTransfer?.files[0];
    if (f?.type === 'application/pdf') readPDF(f);
  });
}

// ════════════════════════════════════════════════════════════
//  PDF READ
// ════════════════════════════════════════════════════════════
function readPDF(file) {
  S.filename = file.name;
  E.pdfName.textContent     = file.name;
  E.pdfStatus.style.display = 'flex';
  const reader = new FileReader();
  reader.onerror = () => toast('Failed to read file.', 'error', 4000);
  reader.onload = async ev => {
    try {
      // Store raw bytes (Uint8Array) — no base64 bloat, no atob decode on every load
      S.pdf = new Uint8Array(ev.target.result);
      S.pdfHash = hashBytes(S.pdf);
      S.annotations = [];
      _editorPdfKey = null; _viewerPdfKey = null; // force re-render in both tabs
      E.editorEmpty.style.display = 'none';
      await DB.set('pdf', S.pdf);
      saveMeta();
      await loadPDF(true);
      renderHlList();
      toast(file.name + ' loaded', 'success', 2500);
    } catch (err) {
      toast('PDF load failed: ' + String(err?.message || err).slice(0, 100), 'error', 5000);
      console.error('[readPDF]', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// base64 data: URL → Uint8Array (used by import + legacy-storage migration)
function toUint8Array(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Uint8Array → base64 data: URL (used only for the portable .alivepdf JSON export)
function bytesToDataURL(bytes) {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return 'data:application/pdf;base64,' + btoa(binary);
}

// Cheap stable content key (djb2 over first 4KB + byte length) for per-PDF reading position
function hashBytes(bytes) {
  let h = 5381;
  const n = Math.min(bytes.length, 4096);
  for (let i = 0; i < n; i++) h = ((h << 5) + h + bytes[i]) | 0;
  return (h >>> 0).toString(36) + '-' + bytes.length.toString(36);
}

// ════════════════════════════════════════════════════════════
//  PDF LOAD & RENDER
// ════════════════════════════════════════════════════════════
let _pdfDocUrl     = null; // cache key: S.pdf reference
// Track what's currently rendered to skip unnecessary re-renders on tab switch
let _editorPdfKey  = null;
let _editorZoomKey = null;
let _viewerPdfKey  = null;
// Live IntersectionObservers per container — disconnected before each re-init to avoid accumulation
let _editorObs = [];
let _viewerObs = [];

function _evictCanvas(wrapper) {
  // Force immediate VRAM/RAM release — browsers hold canvas backing store until GC otherwise
  const c = wrapper.querySelector('canvas');
  if (c) { c.width = 0; c.height = 0; }
}

async function loadPDF(isEditor) {
  const container = isEditor ? E.editorScroll : E.viewerScroll;
  container.innerHTML = '';
  // Re-parse only when the PDF data changed (avoids expensive re-decode on tab switch)
  if (_pdfDocUrl !== S.pdf || !pdfDoc) {
    // Pass a copy — PDF.js may transfer/detach the buffer, and we keep S.pdf for export.
    pdfDoc = await pdfjsLib.getDocument({ data: S.pdf.slice() }).promise;
    _pdfDocUrl = S.pdf;
  }

  if (isEditor) {
    initVirtualScroll();
    _editorPdfKey  = S.pdf;
    _editorZoomKey = S.zoom;
  } else {
    triggered.clear();
    floatBubbles.clear();
    await initViewerVirtualScroll();
    _viewerPdfKey = S.pdf;
  }
}

// Virtual scroll for VIEWER
async function initViewerVirtualScroll() {
  const container    = E.viewerScroll;
  // ponytail: 2.0× (192 DPI) — same visual quality at normal zoom, 55% less canvas RAM than 3.0×
  const displayScale = 2.0;

  // Use page 1 size for all placeholders — O(1) instead of O(N) getPage calls
  const pg1 = await pdfDoc.getPage(1);
  const vp1 = pg1.getViewport({ scale: displayScale });
  const ph1w = Math.round(vp1.width);
  const ph1h = Math.round(vp1.height);

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const ph = document.createElement('div');
    ph.className    = 'page-ph';
    ph.dataset.page = i;
    ph.style.width  = ph1w + 'px';
    ph.style.height = ph1h + 'px';
    ph.textContent  = 'Page ' + i;
    container.appendChild(ph);
  }

  // Two observers: render (400px lookahead) + evict (free canvases >2000px away)
  _viewerObs.forEach(o => o.disconnect());  // drop observers from a prior init
  _viewerObs = [];
  let renderObs, evictObs;

  renderObs = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const ph = entry.target;
      if (ph.dataset.rendered) continue;
      ph.dataset.rendered = '1';
      renderObs.unobserve(ph);
      const wrapper = await renderPage(parseInt(ph.dataset.page), container, false);
      ph.replaceWith(wrapper);
      evictObs.observe(wrapper);
    }
  }, { root: container, rootMargin: '400px', threshold: 0 });

  // When a rendered page leaves the 2000px keepalive zone, free its canvas and reset to placeholder
  evictObs = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) continue;
      const wrapper = entry.target;
      if (!wrapper.dataset.page) continue;
      evictObs.unobserve(wrapper);
      _evictCanvas(wrapper);
      const pageNum = parseInt(wrapper.dataset.page);
      const ph = document.createElement('div');
      ph.className    = 'page-ph';
      ph.dataset.page = pageNum;
      ph.style.width  = wrapper.style.width;
      ph.style.height = wrapper.style.height;
      ph.textContent  = 'Page ' + pageNum;
      wrapper.replaceWith(ph);
      renderObs.observe(ph);
    }
  }, { root: container, rootMargin: '2000px', threshold: 0 });

  _viewerObs = [renderObs, evictObs];
  container.querySelectorAll('.page-ph').forEach(ph => renderObs.observe(ph));
  E.viewerPageTotal.textContent = '/ ' + pdfDoc.numPages;
  if (E.pageTotalEditor) E.pageTotalEditor.textContent = '/ ' + pdfDoc.numPages;
  container.style.zoom = S.zoom || 1;
  renderAnnotDots();
}

function initVirtualScroll() {
  const container = E.editorScroll;
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const ph = document.createElement('div');
    ph.className    = 'page-ph';
    ph.dataset.page = i;
    ph.textContent  = 'Page ' + i;
    ph.style.minHeight = '500px';
    container.appendChild(ph);
  }

  _editorObs.forEach(o => o.disconnect());  // drop observers from a prior init (e.g. zoom re-render)
  _editorObs = [];
  let renderObs, evictObs;

  renderObs = new IntersectionObserver(async (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const ph = entry.target;
      if (ph.dataset.rendered) continue;
      ph.dataset.rendered = '1';
      renderObs.unobserve(ph);
      const wrapper = await renderPage(parseInt(ph.dataset.page), container, true);
      ph.replaceWith(wrapper);
      evictObs.observe(wrapper);
    }
  }, { root: null, rootMargin: '400px', threshold: 0 });

  evictObs = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) continue;
      const wrapper = entry.target;
      if (!wrapper.dataset.page) continue;
      evictObs.unobserve(wrapper);
      _evictCanvas(wrapper);
      const pageNum = parseInt(wrapper.dataset.page);
      const ph = document.createElement('div');
      ph.className    = 'page-ph';
      ph.dataset.page = pageNum;
      ph.style.width  = wrapper.style.width  || '100%';
      ph.style.height = wrapper.style.height || '500px';
      ph.textContent  = 'Page ' + pageNum;
      wrapper.replaceWith(ph);
      renderObs.observe(ph);
    }
  }, { root: null, rootMargin: '2000px', threshold: 0 });

  _editorObs = [renderObs, evictObs];
  container.querySelectorAll('.page-ph').forEach(ph => renderObs.observe(ph));
}

// Render queue — max 3 concurrent renders
let _renderActive = 0;
const _renderQueue = [];
function _flushRenderQueue() {
  while (_renderActive < 3 && _renderQueue.length) {
    _renderActive++;
    const { resolve } = _renderQueue.shift();
    resolve();
  }
}
function _waitRenderSlot() {
  return new Promise(resolve => {
    _renderQueue.push({ resolve });
    _flushRenderQueue();
  });
}


async function renderPage(pageNum, container, isEditor) {
  await _waitRenderSlot();
  try {
  const page = await pdfDoc.getPage(pageNum);
  // Both modes DPR=1: CSS zoom handles visual scaling; dpr>1 only multiplies canvas memory.
  const dpr          = 1;
  // Viewer: 2.0× = 192 DPI — same visual quality as 3.0× at normal zoom, 55% less RAM.
  // Editor: 2.0×zoom so draw-rect % coordinates match canvas dimensions exactly.
  const displayScale = isEditor ? 2.0 * (S.zoom || 1) : 2.0;
  const vp   = page.getViewport({ scale: displayScale * dpr });
  // Round once, use same value for wrapper + canvas — prevents 1px stretch
  const cssW = Math.round(vp.width  / dpr);
  const cssH = Math.round(vp.height / dpr);

  const wrapper = document.createElement('div');
  wrapper.className    = 'page-wrapper';
  wrapper.dataset.page = pageNum;
  wrapper.style.width  = cssW + 'px';
  wrapper.style.height = cssH + 'px';

  const canvas = document.createElement('canvas');
  canvas.width        = cssW * dpr; // exact integer pixels
  canvas.height       = cssH * dpr;
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';
  wrapper.appendChild(canvas);

  const vpRender = page.getViewport({ scale: displayScale });
  const ctx = canvas.getContext('2d', { alpha: false });
  await page.render({ canvasContext: ctx, viewport: vpRender }).promise;

  if (S.wmOnPdf && S.wm) addWatermark(wrapper);

  if (isEditor) {
    const layer = document.createElement('div');
    layer.className    = 'draw-layer';
    layer.dataset.page = pageNum;
    wrapper.appendChild(layer);
    renderEditorAnns(layer, pageNum);
    setupDrawEvents(layer, pageNum);
  } else {
    addViewerAnns(wrapper, pageNum);
    // Selectable/searchable/screen-reader text layer over the canvas (viewer only)
    try {
      const textContent = await page.getTextContent();
      const tl = document.createElement('div');
      tl.className = 'textLayer';
      tl.style.width  = cssW + 'px';
      tl.style.height = cssH + 'px';
      tl.style.setProperty('--scale-factor', String(displayScale));
      wrapper.appendChild(tl);
      await pdfjsLib.renderTextLayer({
        textContentSource: textContent,   // non-deprecated param name (v3.4+)
        container: tl,
        viewport: vpRender,
        textDivs: [],
      }).promise;
    } catch { /* image-only page or no text — skip silently */ }
  }
  return wrapper;
  } finally {
    _renderActive--;
    _flushRenderQueue();
  }
}

// ════════════════════════════════════════════════════════════
//  WATERMARK
// ════════════════════════════════════════════════════════════
function addWatermark(wrapper) {
  const ov   = document.createElement('div');
  ov.className = 'wm-overlay';
  const span = document.createElement('span');
  span.textContent = S.wm;
  const pageW = parseInt(wrapper.style.width);
  span.style.cssText =
    'opacity:' + S.wmOpacity + ';' +
    'transform:rotate(' + S.wmAngle + 'deg);' +
    'font-size:' + Math.max(14, pageW * 0.05) + 'px;';
  ov.appendChild(span);
  wrapper.appendChild(ov);
}

// ════════════════════════════════════════════════════════════
//  EDITOR: ANNOTATION BOXES
// ════════════════════════════════════════════════════════════
function renderEditorAnns(layer, pageNum) {
  layer.querySelectorAll('.ann-box').forEach(b => b.remove());
  S.annotations.filter(a => a.page === pageNum).forEach(ann => {
    const x0  = ann.x0 ?? 2;
    const x1  = ann.x1 ?? 98;
    const box = document.createElement('div');
    box.className    = 'ann-box';
    box.style.top    = ann.y0 + '%';
    box.style.height = ann.h  + '%';
    box.style.left   = x0 + '%';
    box.style.width  = (x1 - x0) + '%';
    box.style.opacity = (ann.showHighlight === false) ? '0.4' : '1';
    if (ann.color && ann.color !== 'gold') {
      box.dataset.color = ann.color;
    }
    const label = [ann.emojis, ann.text].filter(Boolean).join(' ');
    box.dataset.emoji = label || '✏️';
    box.title = (label || '(no emojis)') + '  ·  Click to delete';
    box.addEventListener('click', e => { e.stopPropagation(); deleteAnnotation(ann.id); });
    layer.appendChild(box);
  });
}

// ════════════════════════════════════════════════════════════
//  EDITOR: DRAW EVENTS
// ════════════════════════════════════════════════════════════
function setupDrawEvents(layer, pageNum) {
  layer.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    closePopover();
    const rect = layer.getBoundingClientRect();
    draw.active = true;
    draw.layer  = layer;
    draw.page   = pageNum;
    draw.startY = e.clientY - rect.top;
    draw.startX = e.clientX - rect.left;
    draw.box = document.createElement('div');
    draw.box.className = 'temp-box';
    draw.box.style.top  = draw.startY + 'px';
    draw.box.style.left = draw.startX + 'px';
    // ponytail: show current color while dragging via CSS vars
    const COLOR_RGB = { gold:'232,168,32', rose:'255,107,138', sky:'56,189,248', mint:'52,211,153', violet:'167,139,250', coral:'251,146,60' };
    const rgb = COLOR_RGB[pendingColor] || COLOR_RGB.gold;
    draw.box.style.setProperty('--draw-color', `rgba(${rgb},.65)`);
    draw.box.style.setProperty('--draw-bg',    `rgba(${rgb},.09)`);
    layer.appendChild(draw.box);
  });

  // Touch support — dispatches synthetic mouse events
  layer.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    layer.dispatchEvent(new MouseEvent('mousedown', {
      clientX: t.clientX, clientY: t.clientY, button: 0, bubbles: true
    }));
  }, { passive: false });

  layer.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: t.clientX, clientY: t.clientY, bubbles: true
    }));
  }, { passive: false });

  layer.addEventListener('touchend', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    document.dispatchEvent(new MouseEvent('mouseup', {
      clientX: t.clientX, clientY: t.clientY, bubbles: true
    }));
  }, { passive: false });

}

function onDrawMove(e) {
  if (!draw.active || !draw.box) return;
  const rect = draw.layer.getBoundingClientRect();
  const curY = clamp(e.clientY - rect.top,  0, rect.height);
  const curX = clamp(e.clientX - rect.left, 0, rect.width);
  const top  = Math.min(draw.startY, curY);
  const h    = Math.abs(draw.startY - curY);
  const left = Math.min(draw.startX, curX);
  const w    = Math.abs(draw.startX - curX);
  draw.box.style.top    = top  + 'px';
  draw.box.style.height = h    + 'px';
  draw.box.style.left   = left + 'px';
  draw.box.style.width  = w    + 'px';
}

function onDrawUp(e) {
  if (!draw.active || !draw.box) return;
  draw.active = false;
  const rect = draw.layer.getBoundingClientRect();
  const curY = clamp(e.clientY - rect.top,  0, rect.height);
  const curX = clamp(e.clientX - rect.left, 0, rect.width);
  const top  = Math.min(draw.startY, curY);
  const h    = Math.abs(draw.startY - curY);
  const left = Math.min(draw.startX, curX);
  const w    = Math.abs(draw.startX - curX);
  if (h > 6 && w > 6) {
    pendingRect = {
      page: draw.page,
      y0: (top  / rect.height) * 100,
      h:  (h    / rect.height) * 100,
      x0: (left / rect.width)  * 100,
      x1: ((left + w) / rect.width) * 100,
    };
    openPopover(rect.left + left + w / 2, rect.top + top + h);
  } else {
    draw.box.remove();
    draw.box = null;
  }
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));

// ════════════════════════════════════════════════════════════
//  POPOVER
// ════════════════════════════════════════════════════════════
function openPopover(x, y) {
  E.emojiInput.value     = '';
  E.floatTextInput.value = '';
  E.popShowHl.checked    = true;
  E.popShowFloat.checked = true;

  // Restore last used color
  document.querySelectorAll('.color-dot').forEach(b => b.classList.remove('active'));
  const goldDot = document.querySelector('.color-dot[data-color="' + pendingColor + '"]');
  if (goldDot) goldDot.classList.add('active');

  E.popover.style.display = 'block';
  const pw  = E.popover.offsetWidth;
  const ph2 = E.popover.offsetHeight;
  E.popover.style.left = clamp(x - pw / 2, 8, window.innerWidth  - pw  - 8) + 'px';
  E.popover.style.top  = clamp(y + 14,     8, window.innerHeight - ph2 - 8) + 'px';
  E.emojiInput.focus();
  trapFocus(E.popover);
}

function closePopover() {
  const wasOpen = E.popover.style.display === 'block';
  E.popover.style.display = 'none';
  draw.box?.remove();
  draw.box    = null;
  pendingRect = null;
  if (wasOpen) releaseFocus();
}

function saveAnnotation() {
  const emojis        = E.emojiInput.value.trim();
  const text          = E.floatTextInput.value.trim();
  const showHighlight = E.popShowHl.checked;
  const showFloat     = E.popShowFloat.checked;

  if (!emojis && !text) {
    E.emojiInput.placeholder = '← add emojis or text first!';
    E.emojiInput.focus();
    return;
  }
  if (!pendingRect) { closePopover(); return; }

  const ann = {
    id:            Date.now().toString(),
    page:          pendingRect.page,
    y0:            +pendingRect.y0.toFixed(3),
    h:             +pendingRect.h.toFixed(3),
    x0:            +pendingRect.x0.toFixed(3),
    x1:            +pendingRect.x1.toFixed(3),
    emojis:        emojis.slice(0, 200),
    text:          text.slice(0, 200),
    showHighlight,
    showFloat,
    color:         pendingColor || 'gold',
  };
  S.annotations.push(ann);
  S.annotations.sort((a, b) => a.page - b.page || a.y0 - b.y0);
  saveMeta();
  renderHlList();
  renderAnnotDots();

  const layer = E.editorScroll.querySelector('.draw-layer[data-page="' + ann.page + '"]');
  if (layer) renderEditorAnns(layer, ann.page);
  closePopover();
  toast('Highlight saved — pg ' + ann.page, 'success', 2200);
  maybeBackupNudge();
}

// One-time reminder that everything is stored locally — a browser data-clear wipes it.
function maybeBackupNudge() {
  try {
    if (localStorage.getItem('apdf_backup_nudged')) return;
    localStorage.setItem('apdf_backup_nudged', '1');
    setTimeout(() => toast('Your reactions are saved on this device only — use ⋯ → Export to back them up.', 'info', 6000), 900);
  } catch {}
}

function deleteAnnotation(id) {
  const ann = S.annotations.find(a => a.id === id);
  if (!ann) return;
  S.annotations = S.annotations.filter(a => a.id !== id);
  saveMeta();
  renderHlList();
  renderAnnotDots();
  const layer = E.editorScroll.querySelector('.draw-layer[data-page="' + ann.page + '"]');
  if (layer) renderEditorAnns(layer, ann.page);
}

function clearAllAnnotations() {
  if (!S.annotations.length) return;
  if (!confirm('Remove all highlights? This cannot be undone.')) return;
  S.annotations = [];
  saveMeta();
  renderHlList();
  E.editorScroll.querySelectorAll('.ann-box').forEach(b => b.remove());
  E.viewerScroll.querySelectorAll('.viewer-ann').forEach(v => v.remove());
  triggered.clear();
}

function toggleAnnProp(id, prop) {
  const ann = S.annotations.find(a => a.id === id);
  if (!ann) return;
  ann[prop] = !ann[prop];
  saveMeta();
  renderHlList();
  const layer = E.editorScroll.querySelector('.draw-layer[data-page="' + ann.page + '"]');
  if (layer) renderEditorAnns(layer, ann.page);
}

// ════════════════════════════════════════════════════════════
//  HIGHLIGHTS SIDEBAR  (DOM-only, no innerHTML with user data)
// ════════════════════════════════════════════════════════════
function renderHlList() {
  E.hlList.innerHTML = '';

  if (!S.annotations.length) {
    const p = document.createElement('p');
    p.className   = 'empty-hint';
    p.textContent = 'No highlights yet.';
    E.hlList.appendChild(p);
    return;
  }

  S.annotations.forEach(ann => {
    const hlOn    = ann.showHighlight !== false;
    const floatOn = ann.showFloat     !== false;
    const label   = [ann.emojis, ann.text].filter(Boolean).join(' ');
    const color   = ann.color || 'gold';

    const item = document.createElement('div');
    item.className = 'hl-item';

    // Info section
    const info = document.createElement('div');
    info.className = 'hl-info';

    const colorDot = document.createElement('span');
    colorDot.className    = 'hl-color-dot';
    colorDot.dataset.color = color;

    const pageSpan = document.createElement('span');
    pageSpan.className   = 'hl-page';
    pageSpan.textContent = 'Pg ' + ann.page;

    info.appendChild(colorDot);
    info.appendChild(pageSpan);

    // Emojis
    const emojisSpan = document.createElement('span');
    emojisSpan.className   = 'hl-emojis';
    emojisSpan.title       = label || '—';
    emojisSpan.textContent = label || '—';

    // Toggle buttons
    const toggles = document.createElement('div');
    toggles.className = 'hl-toggles';

    const hlBtn = document.createElement('button');
    hlBtn.className      = 'toggle-btn' + (hlOn ? ' on' : '');
    hlBtn.dataset.id     = ann.id;
    hlBtn.dataset.prop   = 'showHighlight';
    hlBtn.title          = hlOn ? 'Highlight ON' : 'Highlight OFF';
    hlBtn.textContent    = '🎨';

    const floatBtn = document.createElement('button');
    floatBtn.className    = 'toggle-btn' + (floatOn ? ' on' : '');
    floatBtn.dataset.id   = ann.id;
    floatBtn.dataset.prop = 'showFloat';
    floatBtn.title        = floatOn ? 'Float ON' : 'Float OFF';
    floatBtn.textContent  = '✨';

    toggles.appendChild(hlBtn);
    toggles.appendChild(floatBtn);

    // Delete
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn del-btn';
    delBtn.title     = 'Delete';
    const delI = document.createElement('i');
    delI.className   = 'fa-solid fa-trash-can';
    delBtn.appendChild(delI);

    item.appendChild(info);
    item.appendChild(emojisSpan);
    item.appendChild(toggles);
    item.appendChild(delBtn);

    hlBtn.addEventListener('click',   e => { e.stopPropagation(); toggleAnnProp(ann.id, 'showHighlight'); });
    floatBtn.addEventListener('click', e => { e.stopPropagation(); toggleAnnProp(ann.id, 'showFloat'); });
    delBtn.addEventListener('click',   e => { e.stopPropagation(); deleteAnnotation(ann.id); });
    item.addEventListener('click', () => {
      const target = E.editorScroll.querySelector('[data-page="' + ann.page + '"]');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    E.hlList.appendChild(item);
  });
}

// ════════════════════════════════════════════════════════════
//  VIEWER: OVERLAYS
// ════════════════════════════════════════════════════════════
function addViewerAnns(wrapper, pageNum) {
  S.annotations.filter(a => a.page === pageNum).forEach(ann => {
    const x0 = ann.x0 ?? 2;
    const x1 = ann.x1 ?? 98;
    const ov = document.createElement('div');
    ov.className    = 'viewer-ann';
    ov.style.top    = ann.y0 + '%';
    ov.style.height = ann.h  + '%';
    ov.style.left   = x0 + '%';
    ov.style.width  = (x1 - x0) + '%';
    ov.dataset.id    = ann.id;
    ov.dataset.color = ann.color || 'gold';
    // If user already scrolled past this annotation, restore the active (highlighted) state
    if (triggered.has(ann.id) && ann.showHighlight !== false) ov.classList.add('active');
    wrapper.appendChild(ov);
  });
}

// ════════════════════════════════════════════════════════════
//  VIEWER: SCROLL TRIGGER
// ════════════════════════════════════════════════════════════
function checkTriggers() {
  const scroll   = E.viewerScroll;
  const area     = E.readingArea;
  const areaRect = area.getBoundingClientRect();
  const zoneTop  = areaRect.top + areaRect.height * 0.28;
  const zoneBot  = areaRect.top + areaRect.height * 0.72;

  const byId = new Map(S.annotations.map(a => [a.id, a])); // ponytail: rebuilt per rAF tick, fine up to 500 anns
  scroll.querySelectorAll('.viewer-ann').forEach(ov => {
    const id  = ov.dataset.id;
    const ann = byId.get(id);
    if (!ann) return;

    const r   = ov.getBoundingClientRect();
    const mid = r.top + r.height / 2;

    if (mid >= zoneTop && mid <= zoneBot) {
      if (!triggered.has(id)) {
        triggered.add(id);

        if (ann.showHighlight !== false) ov.classList.add('active');

        if (ann.showFloat !== false && (ann.emojis || ann.text)) {
          spawnFloatEffect(ann, ov.closest('.page-wrapper'));
        }
      }
    } else if (mid < areaRect.top - 80 || mid > areaRect.bottom + 80) {
      triggered.delete(id);
      ov.classList.remove('active');
      const bubble = floatBubbles.get(id);
      if (bubble && !bubble.classList.contains('leaving')) {
        bubble.classList.add('leaving');
        setTimeout(() => removeFloatBubble(id), 460);
      }
    }
  });
}

// ════════════════════════════════════════════════════════════
//  FLOAT EFFECT
// ════════════════════════════════════════════════════════════
function spawnFloatEffect(ann, wrapper) {
  if (floatBubbles.has(ann.id)) return;           // already showing
  const parts = [ann.emojis, ann.text].filter(Boolean).join(' ');
  if (!parts || !wrapper) return;

  const span = document.createElement('span');
  span.className   = 'float-bubble';
  span.textContent = parts;

  // Place in viewer-scroll (not inside page-wrapper which clips with overflow:hidden).
  // Use layout offsets so the bubble scrolls with the page content.
  const leftPx = wrapper.offsetLeft + ((ann.x0 ?? 2) / 100) * wrapper.offsetWidth;
  const topPx  = wrapper.offsetTop  + (((ann.y0 ?? 0) + (ann.h ?? 0) / 2) / 100) * wrapper.offsetHeight;
  span.style.left = leftPx + 'px';
  span.style.top  = topPx  + 'px';

  E.viewerScroll.appendChild(span);
  floatBubbles.set(ann.id, span);
}

function removeFloatBubble(annId) {
  const el = floatBubbles.get(annId);
  if (el) { el.remove(); floatBubbles.delete(annId); }
}

function renderAnnotDots() {
  E.annDots.innerHTML = '';
  if (!pdfDoc || !S.annotations.length) return;
  const pages = [...new Set(S.annotations.map(a => a.page))];
  pages.forEach(p => {
    const dot = document.createElement('div');
    dot.className = 'ann-dot';
    dot.style.top = ((p - 0.5) / pdfDoc.numPages * 100) + '%';
    E.annDots.appendChild(dot);
  });
}

// ════════════════════════════════════════════════════════════
//  VIEW SWITCH
// ════════════════════════════════════════════════════════════
async function switchView(view) {
  closePopover();

  if (view === 'editor') {
    E.btnEditor.classList.add('active');
    E.btnViewer.classList.remove('active');
    E.editorScreen.classList.add('active');
    E.viewerScreen.classList.remove('active');
    E.readingArea.style.display   = 'none';
    E.viewerToolbar.style.display = 'none';
    if (S.pdf) {
      E.editorEmpty.style.display = 'none';
      // Skip re-render if same PDF + same zoom already rendered
      const needsRender = _editorPdfKey !== S.pdf || _editorZoomKey !== S.zoom;
      if (needsRender) await loadPDF(true);
    }
  } else {
    E.btnEditor.classList.remove('active');
    E.btnViewer.classList.add('active');
    E.editorScreen.classList.remove('active');
    E.viewerScreen.classList.add('active');

    if (S.pdf) {
      E.viewerEmpty.style.display   = 'none';
      E.readingArea.style.display   = 'flex';
      E.viewerToolbar.style.display = 'flex';
      if (_viewerPdfKey !== S.pdf) {
        // First time showing this PDF in viewer
        resetReadingProgress();
        await loadPDF(false);
        const pos = getReadingPos();
        E.viewerScroll.scrollTop = pos;
        updateReadingProgress();
      } else {
        // Already rendered — just sync zoom + annotation dots
        E.viewerScroll.style.zoom = S.zoom || 1;
        renderAnnotDots();
      }
    } else {
      E.viewerEmpty.style.display   = 'flex';
      E.readingArea.style.display   = 'none';
      E.viewerToolbar.style.display = 'none';
    }
  }
}

// ════════════════════════════════════════════════════════════
//  ZOOM
// ════════════════════════════════════════════════════════════
async function setZoom(value) {
  await changeZoom(value - S.zoom);
}

async function changeZoom(delta) {
  S.zoom = clamp(S.zoom + delta, 0.5, 3);
  const pct = Math.round(S.zoom * 100) + '%';
  E.zoomLabel.value       = pct;
  E.viewerZoomLabel.value = pct;
  saveMeta();
  if (!S.pdf) return;

  const inViewer = E.viewerScreen.classList.contains('active');
  if (inViewer) {
    // CSS zoom — instant, no re-render, canvases already at 2× base quality
    const ratio = E.viewerScroll.scrollTop / (E.viewerScroll.scrollHeight || 1);
    E.viewerScroll.style.zoom = S.zoom;
    E.viewerScroll.scrollTop  = ratio * E.viewerScroll.scrollHeight;
  } else {
    const ratio = E.editorScroll.scrollTop / (E.editorScroll.scrollHeight || 1);
    await loadPDF(true);
    E.editorScroll.scrollTop = ratio * E.editorScroll.scrollHeight;
  }
}

// ════════════════════════════════════════════════════════════
//  PAGE NAVIGATION
// ════════════════════════════════════════════════════════════
function jumpToPage() {
  const n = parseInt(E.jumpInput.value);
  if (!n || n < 1) return;
  const target = E.editorScroll.querySelector('[data-page="' + n + '"]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function viewerGoPage() {
  const n = parseInt(E.viewerPageInput.value);
  if (!n || n < 1) return;
  const target = E.viewerScroll.querySelector('[data-page="' + n + '"]');
  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  E.viewerPageInput.value = '';
}

// ════════════════════════════════════════════════════════════
//  EXPORT / IMPORT PROJECT
// ════════════════════════════════════════════════════════════
async function exportProject() {
  if (!S.pdf) { toast('Please load a PDF first.', 'info'); return; }
  // S.pdf is now raw bytes — serialize as base64 data URL for the portable JSON format
  const { pdf, ...meta } = S;
  const out = { ...meta, pdf: bytesToDataURL(S.pdf) };
  const blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (S.filename || 'project').replace(/[^a-zA-Z0-9؀-ۿ._-]/g, '-') + '.alivepdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
  toast('Project exported.', 'success', 2200);
}

function importProject(e) {
  const f = e.target.files[0];
  if (!f) return;
  // 50 MB limit
  if (f.size > 50 * 1024 * 1024) {
    toast('File too large (max 50 MB).', 'error', 4000);
    E.importFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = async ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (typeof data !== 'object' || data === null) throw new Error('Invalid file.');
      // Validate PDF field
      if (typeof data.pdf !== 'string' || !data.pdf.startsWith('data:application/pdf;base64,')) {
        throw new Error('Missing or invalid PDF data.');
      }
      if (!Array.isArray(data.annotations)) throw new Error('Missing annotations.');

      // Whitelist-only field assignment (no Object.assign)
      const strFields  = ['filename','wm','theme','novelTitle','creator'];
      const numFields  = ['wmOpacity','wmAngle','zoom','hlSpeed'];
      const boolFields = ['wmOnPdf'];
      for (const k of strFields)  { if (k in data && typeof data[k] === 'string')  S[k] = data[k].slice(0, 500); }
      for (const k of numFields)  { if (k in data && typeof data[k] === 'number' && isFinite(data[k])) S[k] = data[k]; }
      for (const k of boolFields) { if (k in data && typeof data[k] === 'boolean') S[k] = data[k]; }
      // Clamp numeric fields to valid ranges
      S.wmOpacity = clamp(S.wmOpacity, 0.05, 0.5);
      S.wmAngle   = clamp(S.wmAngle,   -90,  90);
      S.zoom      = clamp(S.zoom,       0.5,  3);
      S.hlSpeed   = clamp(S.hlSpeed ?? 1.8, 0.01, 3.6);
      S.pdf = toUint8Array(data.pdf);   // base64 data URL → raw bytes
      S.pdfHash = hashBytes(S.pdf);
      _editorPdfKey = null; _viewerPdfKey = null;
      S.annotations = sanitizeAnnotations(data.annotations);

      await DB.set('pdf', S.pdf);
      saveMeta();
      syncUIFromState();
      E.pdfName.textContent       = S.filename;
      E.pdfStatus.style.display   = 'flex';
      E.editorEmpty.style.display = 'none';
      await loadPDF(true);
      renderHlList();
      toast('Project imported successfully.', 'success');
    } catch (err) {
      toast('Import failed: ' + safeMsg(err), 'error', 5000);
    }
    E.importFile.value = '';
  };
  reader.readAsText(f);
}

// ════════════════════════════════════════════════════════════
//  EXPORT / IMPORT REACTION PACK
// ════════════════════════════════════════════════════════════
async function exportPack() {
  if (!S.annotations.length) { toast('No annotations to export.', 'info'); return; }
  const pack = {
    __type:      'alivepdf-reactions',
    version:     1,
    novelTitle:  S.novelTitle || S.filename || 'Untitled',
    creator:     S.creator    || 'Anonymous',
    exportedAt:  new Date().toISOString(),
    annotations: S.annotations.map(function(a) {
      return {
        id:            a.id,
        page:          a.page,
        y0:            a.y0,
        h:             a.h,
        x0:            a.x0,
        x1:            a.x1,
        emojis:        a.emojis,
        text:          a.text,
        showHighlight: a.showHighlight,
        showFloat:     a.showFloat,
        color:         a.color || 'gold',
      };
    }),
  };
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (S.novelTitle || S.filename || 'reactions').replace(/[^a-zA-Z0-9؀-ۿ._-]/g, '-') + '.reactions.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
  toast('Reaction pack exported (' + S.annotations.length + ' highlights).', 'success', 2500);
}

function importPack(e) {
  const f = e.target.files[0];
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) {
    toast('Pack file too large (max 5 MB).', 'error');
    E.importPackFile.value = '';
    return;
  }
  if (!S.pdf) {
    toast('Load a PDF first, then import a reaction pack.', 'info');
    E.importPackFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (typeof data !== 'object' || data === null) throw new Error('Invalid pack format.');
      if (data.__type !== 'alivepdf-reactions') throw new Error('Not a reaction pack file.');
      if (!Array.isArray(data.annotations))     throw new Error('No annotations in pack.');

      const newAnns     = sanitizeAnnotations(data.annotations);
      const existingIds = new Set(S.annotations.map(a => a.id));
      const merged      = [...S.annotations, ...newAnns.filter(a => !existingIds.has(a.id))];
      merged.sort((a, b) => a.page - b.page || a.y0 - b.y0);
      S.annotations = merged;
      saveMeta();
      renderHlList();
      toast('Loaded ' + newAnns.length + ' reactions from pack.', 'success');
    } catch (err) {
      toast('Pack import failed: ' + safeMsg(err), 'error', 5000);
    }
    E.importPackFile.value = '';
  };
  reader.readAsText(f);
}

// ════════════════════════════════════════════════════════════
//  URL-HASH SHARING  (no backend — pack encoded in the link)
// ════════════════════════════════════════════════════════════
function b64urlEncode(bytes) {
  let bin = '';
  const C = 0x8000;
  for (let i = 0; i < bytes.length; i += C) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + C));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
async function gzip(str) {
  const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

function packForShare() {
  return {
    __type: 'alivepdf-reactions',
    version: 1,
    novelTitle: S.novelTitle || S.filename || 'Untitled',
    creator:    S.creator || 'Anonymous',
    annotations: S.annotations.map(a => ({
      id: a.id, page: a.page, y0: a.y0, h: a.h, x0: a.x0, x1: a.x1,
      emojis: a.emojis, text: a.text, showHighlight: a.showHighlight,
      showFloat: a.showFloat, color: a.color || 'gold',
    })),
  };
}

async function shareReactionsLink() {
  E.moreMenu.hidden = true;
  if (!S.annotations.length) { toast('No reactions to share yet.', 'info'); return; }
  try {
    const json = JSON.stringify(packForShare());
    // 'g' = gzipped (native CompressionStream), 'r' = raw base64url fallback
    let payload;
    if (typeof CompressionStream !== 'undefined') payload = 'g' + b64urlEncode(await gzip(json));
    else payload = 'r' + b64urlEncode(new TextEncoder().encode(json));

    const url = location.origin + location.pathname + '#pack=' + payload;
    // ponytail: URL length ceiling ~ a few hundred small reactions; past that, tell them to use file export
    if (url.length > 8000) {
      toast('Too many reactions for a link — use ⋯ → Share Pack (file) instead.', 'info', 6000);
      return;
    }
    try { await navigator.clipboard.writeText(url); toast('Share link copied to clipboard.', 'success', 2600); }
    catch { window.prompt('Copy this share link:', url); }
  } catch (err) {
    toast('Could not build share link: ' + safeMsg(err), 'error', 5000);
  }
}

async function applyPackFromHash() {
  const m = location.hash.match(/^#pack=(.+)$/);
  if (!m) return;
  // Clear the hash so a refresh doesn't re-import
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}

  let json;
  try {
    const payload = m[1], kind = payload[0], body = payload.slice(1);
    json = kind === 'g' ? await gunzip(b64urlDecode(body))
                        : new TextDecoder().decode(b64urlDecode(body));
  } catch { toast('Could not read shared link.', 'error', 4000); return; }

  let data;
  try { data = JSON.parse(json); } catch { toast('Shared link is corrupt.', 'error', 4000); return; }
  if (data.__type !== 'alivepdf-reactions' || !Array.isArray(data.annotations)) {
    toast('Not a valid reactions link.', 'error', 4000); return;
  }
  if (!S.pdf) {
    toast('Load the matching PDF first, then re-open this link to apply the reactions.', 'info', 6500);
    return;
  }
  const newAnns = sanitizeAnnotations(data.annotations);
  const ids = new Set(S.annotations.map(a => a.id));
  S.annotations = [...S.annotations, ...newAnns.filter(a => !ids.has(a.id))]
    .sort((a, b) => a.page - b.page || a.y0 - b.y0);
  saveMeta();
  renderHlList();
  renderAnnotDots();
  toast('Loaded ' + newAnns.length + ' shared reactions' + (data.creator ? ' from ' + data.creator : '') + '.', 'success', 3500);
}

// ════════════════════════════════════════════════════════════
//  INPUT SANITISATION HELPERS
// ════════════════════════════════════════════════════════════
const VALID_COLORS = new Set(['gold','rose','sky','mint','violet','coral']);

function sanitizeAnnotations(raw) {
  if (!Array.isArray(raw)) return [];
  const MAX     = 500;
  const MAX_STR = 200;
  return raw.slice(0, MAX)
    .filter(a => typeof a === 'object' && a !== null)
    .map(a => ({
      id:            String(a.id || Date.now()).slice(0, 32),
      page:          Math.max(1, Math.min(9999, parseInt(a.page) || 1)),
      y0:            +parseFloat(a.y0 || 0).toFixed(3),
      h:             +parseFloat(a.h  || 0).toFixed(3),
      x0:            +parseFloat(a.x0 || 0).toFixed(3),
      x1:            +parseFloat(a.x1 || 100).toFixed(3),
      emojis:        String(a.emojis || '').slice(0, MAX_STR),
      text:          String(a.text   || '').slice(0, MAX_STR),
      showHighlight: a.showHighlight !== false,
      showFloat:     a.showFloat     !== false,
      color:         VALID_COLORS.has(a.color) ? a.color : 'gold',
    }));
}

function safeMsg(err) {
  // Never leak raw Error objects into the DOM
  try { return String(err.message || err).slice(0, 120); } catch { return 'Unknown error'; }
}

// ════════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS  (DOM-only — no innerHTML with user data)
// ════════════════════════════════════════════════════════════
const TOAST_ICONS = { success: '✓', error: '✕', info: '✦' };

function toast(msg, type, duration) {
  type     = type     || 'info';
  duration = duration || 3000;
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = 'toast ' + type;

  const icon = document.createElement('span');
  icon.className   = 'toast-icon';
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;

  const msgEl = document.createElement('span');
  msgEl.className   = 'toast-msg';
  msgEl.textContent = String(msg).slice(0, 200); // textContent — XSS-safe

  el.appendChild(icon);
  el.appendChild(msgEl);
  container.appendChild(el);

  const dismiss = function() {
    if (el.classList.contains('toast-out')) return;
    el.classList.add('toast-out');
    setTimeout(function() { el.remove(); }, 240);
  };
  setTimeout(dismiss, duration);
  el.addEventListener('click', dismiss);
}

// ════════════════════════════════════════════════════════════
//  READING PROGRESS + PAGE BADGE
// ════════════════════════════════════════════════════════════
function updateReadingProgress() {
  const scroll = E.viewerScroll;
  const total  = scroll.scrollHeight - scroll.clientHeight;
  const pct    = total > 0 ? (scroll.scrollTop / total) * 100 : 0;
  const bar    = document.getElementById('reading-progress');
  if (bar) bar.style.width = pct.toFixed(1) + '%';
}

function getVisiblePage(scrollEl) {
  if (!pdfDoc) return 0;
  const rect = scrollEl.getBoundingClientRect();
  let currentPage = 0, maxVis = 0;
  scrollEl.querySelectorAll('.page-wrapper[data-page]').forEach(function(w) {
    const r   = w.getBoundingClientRect();
    const vis = Math.max(0, Math.min(r.bottom, rect.bottom) - Math.max(r.top, rect.top));
    if (vis > maxVis) { maxVis = vis; currentPage = parseInt(w.dataset.page); }
  });
  return currentPage;
}

function updatePageBadge() {
  if (!pdfDoc) return;
  const inViewer = E.viewerScreen.classList.contains('active');
  const scrollEl = inViewer ? E.viewerScroll : E.editorScroll;
  const currentPage = getVisiblePage(scrollEl);
  if (!currentPage) return;

  // Update page input fields
  E.viewerPageInput.value = currentPage;
  if (E.jumpInput) E.jumpInput.value = currentPage;

  // Update browser tab title
  const base = S.filename ? S.filename.replace(/\.pdf$/i, '') : 'Alive PDF';
  document.title = 'p.' + currentPage + ' — ' + base;
}

function resetReadingProgress() {
  const bar = document.getElementById('reading-progress');
  if (bar) bar.style.width = '0%';
}

// ============================================================
//  BOOTSTRAP
// ============================================================
setupEvents();
loadSaved().then(applyPackFromHash);
