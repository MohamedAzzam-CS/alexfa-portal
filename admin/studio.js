// ============================================================================
// Alexanders Visual Studio — Focused 4-Capability Editor + Site-Wide Chrome Sync
// + Dedicated Prompt-Admin Direct Save (No PR)
// ============================================================================

const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
const API_BASE =
  typeof window !== "undefined" && typeof window.ALEXANDERS_CMS_API_BASE === "string"
    ? window.ALEXANDERS_CMS_API_BASE
    : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
      ? ""
      : DEFAULT_WORKER_ORIGIN;

const SITE_PAGES = [
  "index.html",
  "events.html",
  "honor.html",
  "about.html",
  "story.html",
  "committees.html",
  "gallery.html",
  "join.html",
  "privacy.html",
  "terms.html",
];

// Huge curated library of Arabic & English Google Fonts
const GOOGLE_FONTS_LIBRARY = [
  // Arabic-first modern & display fonts
  { name: "Cairo", label: "Cairo (كايرو - عربي وإنجليزي)" },
  { name: "Tajawal", label: "Tajawal (تجوال - عربي حديث)" },
  { name: "Almarai", label: "Almarai (المراعي - واضح وأنيق)" },
  { name: "IBM Plex Sans Arabic", label: "IBM Plex Sans Arabic (تقني احترافي)" },
  { name: "Readex Pro", label: "Readex Pro (ريدكس - عصري)" },
  { name: "Alexandria", label: "Alexandria (الإسكندرية - هندسي)" },
  { name: "Changa", label: "Changa (تشانجا - عريض ومميز)" },
  { name: "Noto Kufi Arabic", label: "Noto Kufi Arabic (كوفي هندسي)" },
  { name: "Rubik", label: "Rubik (روبيك - ناعم وحديث)" },
  { name: "El Messiri", label: "El Messiri (المسيري - كلاسيكي أنيق)" },
  { name: "Amiri", label: "Amiri (الأميري - تقليدي فخم)" },
  { name: "Vazirmatn", label: "Vazirmatn (وزير - قراءة مريحة)" },
  { name: "Lalezar", label: "Lalezar (لالزار - عناوين ضخمة)" },
  { name: "Marhey", label: "Marhey (مرحي - إبداعي ومرح)" },
  { name: "Aref Ruqaa", label: "Aref Ruqaa (عارف رقعة - خط رقعة)" },
  { name: "Reem Kufi", label: "Reem Kufi (ريم كوفي - فني)" },
  { name: "Harmattan", label: "Harmattan (هارماتان - بسيط)" },
  { name: "Mada", label: "Mada (مدى - خفيف)" },
  // English / Latin display & UI fonts
  { name: "Poppins", label: "Poppins (English Modern)" },
  { name: "Montserrat", label: "Montserrat (English Geometric)" },
  { name: "Inter", label: "Inter (English Clean UI)" },
  { name: "Plus Jakarta Sans", label: "Plus Jakarta Sans (Startup UI)" },
  { name: "Outfit", label: "Outfit (Modern Headings)" },
  { name: "Space Grotesk", label: "Space Grotesk (Tech Display)" },
  { name: "Playfair Display", label: "Playfair Display (Luxury Serif)" },
  { name: "Raleway", label: "Raleway (Elegant Sans)" },
  { name: "Oswald", label: "Oswald (Bold Condensed)" },
  { name: "Merriweather", label: "Merriweather (Editorial Serif)" },
];

const PAGE_EXTRA_CSS = {
  "index.html": ["css/home.css"],
  "about.html": ["css/about.css"],
  "story.html": ["css/story.css"],
};

const TEXT_TAGS = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "span",
  "a",
  "button",
  "li",
  "strong",
  "em",
  "small",
]);

const TEXT_CLASSES = [
  "image-label",
  "text-bubble",
  "leader-role",
  "leader-name",
  "leader-desc",
  "stat-number",
  "stat-label",
  "credit",
  "card-number",
  "card-tag",
  "est-badge",
  "section-label",
];

// Decorative / absolutely positioned elements that must NOT be duplicated in place (prevents overlap)
const NON_DUPLICABLE_CLASSES = [
  "timeline-dot",
  "image-label",
  "event-overlay",
  "hero-founder-badge",
  "navbar",
  "footer",
  "theme-toggle",
  "hamburger",
];

const SOLID_COLOR_TOKENS = [
  { token: "--bg-primary", label: "الخلفية الأساسية" },
  { token: "--bg-secondary", label: "الخلفية الثانوية" },
  { token: "--text-primary", label: "لون النص الرئيسي" },
  { token: "--text-secondary", label: "لون النص الثانوي" },
  { token: "--text-muted", label: "لون النص الخافت" },
  { token: "--accent-blue", label: "الأزرق الأساسي" },
  { token: "--accent-blue-light", label: "الأزرق الفاتح" },
  { token: "--accent-cyan", label: "السماوي المميز" },
  { token: "--accent-indigo", label: "البنفسجي المميز" },
  { token: "--status-live", label: "لون نقطة الحالة النشطة" },
  { token: "--btn-cta-bg", label: "خلفية زر الانضمام (CTA)" },
  { token: "--btn-cta-text", label: "نص زر الانضمام (CTA)" },
  { token: "--footer-bg", label: "خلفية التذييل (Footer)" },
  { token: "--toggle-bg", label: "خلفية زر الوضع الليلي" },
  { token: "--toggle-dot", label: "دائرة زر الوضع الليلي" },
  { token: "--timeline-dot", label: "نقطة خط القصة (Timeline)" },
];

const GRADIENT_TOKENS = [
  { token: "--accent-gradient", label: "التدرج الرئيسي للأزرار والعناوين" },
  { token: "--accent-gradient-subtle", label: "تدرج الشارات الخفيف" },
  { token: "--cta-bg", label: "تدرج صندوق الدعوة للانضمام (CTA)" },
  { token: "--timeline-line", label: "تدرج خط القصة الزمني" },
  { token: "--section-alt-bg", label: "تدرج خلفية الأقسام البديلة" },
  { token: "--offer-icon-bg", label: "تدرج أيقونات الخدمات" },
  { token: "--card-media-placeholder", label: "تدرج خلفية صور البطاقات" },
  { token: "--event-overlay-bg", label: "تدرج تغطية صور الفعاليات" },
  { token: "--ambient-blob-top", label: "توهج الخلفية العلوي" },
  { token: "--ambient-blob-bottom", label: "توهج الخلفية السفلي" },
];

// State
let editor = null;
let currentPageFile = "index.html";
let activeThemeScope = "dark";
let variablesCssText = "";
let variablesCssDirty = false;
let suppressDirtyTracking = false;

// Shared Navbar / Footer sync state (propagated across all site pages when edited)
let sharedNavbarHtml = null;
let sharedFooterHtml = null;
let sharedChromeDirty = false;

const pageDrafts = new Map(); // filename -> { title, extraCss, bodyHtml, scopedCss, dirty }
const uploadedAssets = new Map(); // "assets/pc/name.ext" -> { base64, dataUrl }
const usedGoogleFonts = new Set(); // extra Google Font family names used in edits

let styleApplyScope = "single"; // "single" | "all"
let aiChangeMode = "minimal"; // "minimal" | "drastic"
let aiChatHistory = [];
let aiBusy = false;
let pendingAiPreview = null; // { pageFile, summary, changes, updatedBodyHtml, updatedScopedCss, fullPreviewHtml }

// DOM refs
const el = {
  loginOverlay: document.getElementById("studioLoginOverlay"),
  loginForm: document.getElementById("studioLoginForm"),
  loginError: document.getElementById("loginError"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  editorNameInput: document.getElementById("editorNameInput"),
  editorPasswordInput: document.getElementById("editorPasswordInput"),
  studioApp: document.getElementById("studioApp"),
  pageSelector: document.getElementById("pageSelector"),
  deviceDesktopBtn: document.getElementById("deviceDesktopBtn"),
  deviceMobileBtn: document.getElementById("deviceMobileBtn"),
  canvasThemeToggleBtn: document.getElementById("canvasThemeToggleBtn"),
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  revertOriginalBtn: document.getElementById("revertOriginalBtn"),
  styleDrawerBtn: document.getElementById("styleDrawerBtn"),
  aiDrawerBtn: document.getElementById("aiDrawerBtn"),
  pendingBadge: document.getElementById("pendingBadge"),
  submitPrBtn: document.getElementById("submitPrBtn"),
  logoutBtn: document.getElementById("logoutBtn"),

  // Drawer A: Element Style & Site Theme
  themeDrawer: document.getElementById("themeDrawer"),
  closeThemeDrawerBtn: document.getElementById("closeThemeDrawerBtn"),
  tabElementStyle: document.getElementById("tabElementStyle"),
  tabSiteTheme: document.getElementById("tabSiteTheme"),
  elementStylePanel: document.getElementById("elementStylePanel"),
  siteThemePanel: document.getElementById("siteThemePanel"),
  selectedElementBadge: document.getElementById("selectedElementBadge"),
  scopeSingleBtn: document.getElementById("scopeSingleBtn"),
  scopeAllBtn: document.getElementById("scopeAllBtn"),
  scopeHintText: document.getElementById("scopeHintText"),
  fontSearchInput: document.getElementById("fontSearchInput"),
  fontFamilySelect: document.getElementById("fontFamilySelect"),
  fontWeightSelect: document.getElementById("fontWeightSelect"),
  elTextColorPicker: document.getElementById("elTextColorPicker"),
  elBgColorPicker: document.getElementById("elBgColorPicker"),
  elBorderColorPicker: document.getElementById("elBorderColorPicker"),
  clearTextColorBtn: document.getElementById("clearTextColorBtn"),
  clearBgColorBtn: document.getElementById("clearBgColorBtn"),
  clearBorderColorBtn: document.getElementById("clearBorderColorBtn"),
  tabDarkTheme: document.getElementById("tabDarkTheme"),
  tabLightTheme: document.getElementById("tabLightTheme"),
  themeTokensContainer: document.getElementById("themeTokensContainer"),

  // Drawer B: Gemini Canvas Round-Trip Designer
  aiDrawer: document.getElementById("aiDrawer"),
  closeAiDrawerBtn: document.getElementById("closeAiDrawerBtn"),
  aiModeMinimalBtn: document.getElementById("aiModeMinimalBtn"),
  aiModeDrasticBtn: document.getElementById("aiModeDrasticBtn"),
  geminiRequestInput: document.getElementById("geminiRequestInput"),
  copyAndOpenGeminiBtn: document.getElementById("copyAndOpenGeminiBtn"),
  geminiCopyStatus: document.getElementById("geminiCopyStatus"),
  geminiPrSummaryInput: document.getElementById("geminiPrSummaryInput"),
  geminiImportTextarea: document.getElementById("geminiImportTextarea"),
  geminiImportError: document.getElementById("geminiImportError"),
  geminiImportSuccess: document.getElementById("geminiImportSuccess"),
  previewGeminiImportBtn: document.getElementById("previewGeminiImportBtn"),

  // Manual PR Modal
  submitPrModal: document.getElementById("submitPrModal"),
  prSummaryInput: document.getElementById("prSummaryInput"),
  prFileList: document.getElementById("prFileList"),
  prError: document.getElementById("prError"),
  prResult: document.getElementById("prResult"),
  cancelPrBtn: document.getElementById("cancelPrBtn"),
  confirmPrBtn: document.getElementById("confirmPrBtn"),
};

// ============================================================================
// 1. Editor Worker Authentication Gate (Cookie + iOS-Safe sessionStorage Bearer)
// ============================================================================
const STUDIO_TOKEN_KEY = "alex_cms_editor_token";

function getStudioAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const tok = sessionStorage.getItem(STUDIO_TOKEN_KEY);
    if (tok) headers.Authorization = `Bearer ${tok}`;
  } catch {
    // ignore storage errors
  }
  return headers;
}

function clearStudioToken() {
  try {
    sessionStorage.removeItem(STUDIO_TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/cms/session`, {
      method: "GET",
      credentials: "include",
      headers: getStudioAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(res.ok && data?.authenticated);
  } catch {
    return false;
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  el.loginError.hidden = true;
  el.loginSubmitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/cms/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        editorName: el.editorNameInput.value.trim(),
        password: el.editorPasswordInput.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.authenticated) {
      el.loginError.textContent = data?.message || "فشل تسجيل الدخول. تحقق من كلمة المرور.";
      el.loginError.hidden = false;
      return;
    }

    if (data.token) {
      try {
        sessionStorage.setItem(STUDIO_TOKEN_KEY, data.token);
      } catch {
        // ignore
      }
    }

    el.editorPasswordInput.value = "";
    await enterStudio();
  } catch {
    el.loginError.textContent = "تعذر الاتصال بخادم Cloudflare Worker.";
    el.loginError.hidden = false;
  } finally {
    el.loginSubmitBtn.disabled = false;
  }
}

async function handleLogout() {
  clearStudioToken();
  try {
    await fetch(`${API_BASE}/api/cms/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  el.studioApp.hidden = true;
  el.loginOverlay.hidden = false;
}

// ============================================================================
// 2. Editable Navbar & Footer + Site-Wide Propagation Helpers
// ============================================================================
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlDocument({ filename, title, extraCss = [], bodyHtml, scopedCss = "" }) {
  const extraCssLinks = extraCss
    .map((href) => `  <link rel="stylesheet" href="${href}">`)
    .join("\n");
  const scopedStyleBlock = scopedCss.trim()
    ? `\n  <style data-cms-scoped="true">\n${scopedCss.trim()}\n  </style>`
    : "";

  // Ensure each page's active navbar link matches its own filename
  const syncedBody = applySharedChromeToBody(bodyHtml, filename);

  const extraFontLinks = Array.from(usedGoogleFonts)
    .filter((f) => f && f !== "Cairo" && f !== "Poppins")
    .map(
      (f) =>
        `  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">`
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="favicon.webp" type="image/webp">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Poppins:wght@600;700;800;900&display=swap" rel="stylesheet">${extraFontLinks ? "\n" + extraFontLinks : ""}
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/style.css">${extraCssLinks ? "\n" + extraCssLinks : ""}${scopedStyleBlock}
</head>
<body>

${syncedBody.trim()}

  <script src="js/main.js"></script>
  <script>
    (() => {
      let loaded = false;
      const loadChat = () => {
        if (loaded) return;
        loaded = true;
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "chat-widget.css";
        document.head.appendChild(css);
        const puter = document.createElement("script");
        puter.src = "https://js.puter.com/v2/";
        const mount = () => {
          const widget = document.createElement("script");
          widget.type = "module";
          widget.src = "chat-widget.js";
          document.body.appendChild(widget);
        };
        puter.onload = mount;
        puter.onerror = mount;
        document.body.appendChild(puter);
      };
      ["pointerdown", "keydown", "touchstart"].forEach((t) => window.addEventListener(t, loadChat, { once: true, passive: true }));
      const schedule = window.requestIdleCallback || ((cb) => setTimeout(cb, 1800));
      schedule(loadChat, { timeout: 4000 });
    })();
  </script>
</body>
</html>
`;
}

/**
 * Extracts the editable body (INCLUDING <nav class="navbar"> and <footer class="footer">)
 * while stripping only <script> and <noscript> tags.
 */
function extractEditableBody(fullHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() || "Alexanders";
  const scopedStyle = doc.querySelector('style[data-cms-scoped="true"]')?.textContent || "";

  doc.body.querySelectorAll("script, noscript").forEach((node) => node.remove());
  doc.body
    .querySelectorAll(".fade-in, .fade-in-left, .fade-in-right, .stagger-children")
    .forEach((node) => node.classList.add("visible"));

  const bodyHtml = doc.body.innerHTML.replace(/(src|srcset)="assets\//g, '$1="../assets/');
  return { title, bodyHtml, scopedCss: scopedStyle };
}

function normalizeExportedHtml(rawHtml) {
  let html = String(rawHtml || "").replace(/(src|srcset)="\.\.\/assets\//g, '$1="assets/');
  for (const [assetPath, meta] of uploadedAssets.entries()) {
    if (meta.dataUrl && html.includes(meta.dataUrl)) {
      html = html.split(meta.dataUrl).join(assetPath);
    }
  }
  return html;
}

/**
 * Captures updated .navbar / .footer markup from the current page body
 * so edits propagate site-wide to all HTML pages on submit.
 */
function captureSharedChromeFromBody(normalizedBodyHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${normalizedBodyHtml}</body>`, "text/html");
  const nav = doc.body.querySelector("nav.navbar");
  const footer = doc.body.querySelector("footer.footer");

  if (nav) {
    nav.querySelectorAll("a.active").forEach((a) => a.classList.remove("active"));
    const nextNav = nav.outerHTML;
    if (sharedNavbarHtml && sharedNavbarHtml !== nextNav) {
      sharedChromeDirty = true;
    }
    sharedNavbarHtml = nextNav;
  }

  if (footer) {
    const nextFooter = footer.outerHTML;
    if (sharedFooterHtml && sharedFooterHtml !== nextFooter) {
      sharedChromeDirty = true;
    }
    sharedFooterHtml = nextFooter;
  }
}

/**
 * Replaces .navbar and .footer inside any page's bodyHtml with the latest
 * shared navbar/footer while setting class="active" on the link matching filename.
 */
function applySharedChromeToBody(bodyHtml, filename) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${bodyHtml}</body>`, "text/html");

  if (sharedNavbarHtml) {
    const existingNav = doc.body.querySelector("nav.navbar");
    const navDoc = parser.parseFromString(`<body>${sharedNavbarHtml}</body>`, "text/html");
    const newNav = navDoc.body.querySelector("nav.navbar");
    if (newNav) {
      newNav.querySelectorAll(".navbar-links a").forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === filename);
      });
      if (existingNav) existingNav.replaceWith(newNav);
      else doc.body.prepend(newNav);
    }
  }

  if (sharedFooterHtml) {
    const existingFooter = doc.body.querySelector("footer.footer");
    const footerDoc = parser.parseFromString(`<body>${sharedFooterHtml}</body>`, "text/html");
    const newFooter = footerDoc.body.querySelector("footer.footer");
    if (newFooter) {
      if (existingFooter) existingFooter.replaceWith(newFooter);
      else doc.body.append(newFooter);
    }
  }

  return doc.body.innerHTML;
}

// ============================================================================
// 3. Focused GrapesJS Setup: Inline Text, Image Swap, Safe Duplicate & Delete
// ============================================================================
function configureComponentGuardrails(component) {
  if (!component) return;
  const tag = String(component.get("tagName") || "").toLowerCase();
  const classes = component.getClasses ? component.getClasses() : [];
  const isProtectedRegion =
    tag === "nav" ||
    tag === "footer" ||
    classes.some((cls) => NON_DUPLICABLE_CLASSES.includes(cls));

  component.set({
    draggable: false,
    droppable: false,
    resizable: false,
    copyable: !isProtectedRegion,
    removable: !isProtectedRegion,
  });

  const isTextLike =
    TEXT_TAGS.has(tag) || classes.some((cls) => TEXT_CLASSES.includes(cls));
  if (isTextLike && tag !== "img" && tag !== "picture" && tag !== "button") {
    component.set({ editable: true });
  }

  const toolbar = [
    {
      attributes: { class: "fa fa-arrow-up", title: "تحديد العنصر الأب (البطاقة/القسم)" },
      command: "select-parent",
    },
  ];

  if (tag === "img") {
    toolbar.unshift({
      attributes: { class: "fa fa-picture-o", title: "تغيير الصورة (Swap Image)" },
      command: "open-assets",
    });
  }

  if (!isProtectedRegion) {
    toolbar.push(
      {
        attributes: { class: "fa fa-clone", title: "تكرار العنصر (Duplicate)" },
        command: "smart-clone",
      },
      {
        attributes: { class: "fa fa-trash-o", title: "حذف العنصر (Delete)" },
        command: "smart-delete",
      }
    );
  }

  component.set({ toolbar });

  const children = component.components ? component.components() : null;
  if (children && children.length) {
    children.forEach((child) => configureComponentGuardrails(child));
  }
}

function syncPictureSourceOnImageSwap(imgComponent) {
  if (!imgComponent || String(imgComponent.get("tagName")).toLowerCase() !== "img") return;
  const parent = imgComponent.parent();
  if (parent && String(parent.get("tagName")).toLowerCase() === "picture") {
    parent.components().forEach((sibling) => {
      if (String(sibling.get("tagName")).toLowerCase() === "source") {
        sibling.remove();
      }
    });
  }
}

const IMAGE_WRAPPER_CARD_CLASSES = [
  "event-card",
  "gallery-item",
  "gallery-card",
  "photo-card",
  "image-card",
  "media-card",
  "carousel-item",
  "slide",
];

/**
 * When duplicating or deleting an <img>, never duplicate/leave a bare <img> inside <picture>.
 * Promotes to <picture>, and if <picture>/<img> is the sole media child of a card wrapper
 * (like .event-card), promotes to that card so duplicating creates two distinct grid items!
 */
function resolveSmartImageActionTarget(component) {
  if (!component) return null;
  let target = component;
  const tag = String(target.get("tagName") || "").toLowerCase();

  if (tag === "img") {
    const parent = target.parent();
    if (parent && String(parent.get("tagName") || "").toLowerCase() === "picture") {
      target = parent;
    }
  }

  const targetTag = String(target.get("tagName") || "").toLowerCase();
  if (targetTag === "img" || targetTag === "picture") {
    const container = target.parent();
    if (container) {
      const cTag = String(container.get("tagName") || "").toLowerCase();
      const cClasses = container.getClasses ? container.getClasses() : [];
      const isProtected =
        cTag === "body" ||
        cTag === "section" ||
        cTag === "nav" ||
        cTag === "footer" ||
        cClasses.some((cls) => NON_DUPLICABLE_CLASSES.includes(cls));

      if (!isProtected) {
        const isNamedImageCard = cClasses.some((cls) => IMAGE_WRAPPER_CARD_CLASSES.includes(cls));
        const elementChildren = container.components().filter((child) => {
          const t = String(child.get("tagName") || "").toLowerCase();
          return Boolean(t);
        });
        if (isNamedImageCard || (elementChildren.length === 1 && (cTag === "div" || cTag === "figure"))) {
          target = container;
        }
      }
    }
  }

  return target;
}

function initGrapesEditor() {
  editor = window.grapesjs.init({
    container: "#gjs",
    height: "100%",
    width: "auto",
    storageManager: false,
    fromElement: false,
    panels: { defaults: [] },
    deviceManager: {
      devices: [
        { name: "Desktop", width: "" },
        { name: "Mobile", width: "390px", widthMedia: "480px" },
      ],
    },
    canvas: {
      styles: [
        "https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Poppins:wght@600;700;800;900&display=swap",
        "../css/variables.css",
        "../css/style.css",
        "../css/home.css",
        "../css/about.css",
        "../css/story.css",
      ],
    },
    assetManager: {
      upload: false,
      uploadText: "اسحب صورة هنا أو اضغط للرفع (سيتم حفظها في assets/pc/)",
      addBtnText: "استخدام رابط",
      uploadFile(ev) {
        const files = ev.dataTransfer ? ev.dataTransfer.files : ev.target.files;
        if (!files || !files.length) return;
        Array.from(files).forEach((file) => {
          const safeName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .replace(/_+/g, "_");
          const targetPath = `assets/pc/${Date.now().toString(36)}-${safeName}`;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = String(reader.result || "");
            const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
            uploadedAssets.set(targetPath, { base64, dataUrl });
            const asset = editor.AssetManager.add({ src: dataUrl, name: targetPath });

            const selected = editor.getSelected();
            if (selected && String(selected.get("tagName")).toLowerCase() === "img") {
              selected.set("src", dataUrl);
              selected.addAttributes({ src: dataUrl });
              syncPictureSourceOnImageSwap(selected);
              editor.Modal.close();
            } else if (asset) {
              editor.AssetManager.render();
            }
            updatePendingBadge();
          };
          reader.readAsDataURL(file);
        });
      },
    },
  });

  editor.on("load", () => {
    applyVariablesToCanvas();
  });

  editor.on("component:add", (comp) => configureComponentGuardrails(comp));
  editor.on("component:selected", (comp) => {
    configureComponentGuardrails(comp);
    syncElementStyleInspector(comp);
  });

  editor.on("component:update:src", (comp) => {
    syncPictureSourceOnImageSwap(comp);
    markCurrentPageDirty();
  });

  editor.on("canvas:dblclick", (ev) => {
    const target = ev?.target;
    if (target && target.tagName === "IMG") {
      const selected = editor.getSelected();
      if (selected && String(selected.get("tagName")).toLowerCase() === "img") {
        editor.runCommand("open-assets", {
          target: selected,
          types: ["image"],
          accept: "image/*",
        });
      }
    }
  });

  const markCurrentPageDirty = () => {
    if (suppressDirtyTracking) return;
    const existing = pageDrafts.get(currentPageFile) || {
      title: `Alexanders | ${currentPageFile}`,
      extraCss: PAGE_EXTRA_CSS[currentPageFile] || [],
    };
    const normalized = normalizeExportedHtml(editor.getHtml());
    captureSharedChromeFromBody(normalized);

    existing.bodyHtml = normalized;
    existing.scopedCss = editor.getCss({ avoidProtected: true }) || "";
    existing.dirty = true;
    pageDrafts.set(currentPageFile, existing);
    updatePendingBadge();
  };

  editor.Commands.add("smart-clone", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected) return;
      const target = resolveSmartImageActionTarget(selected);
      const parent = target?.parent();
      if (!target || !parent) return;
      const idx = target.index();
      const cloned = target.clone();
      parent.append(cloned, { at: idx + 1 });
      configureComponentGuardrails(cloned);
      // Select the newly cloned image (if any) so the user can swap it immediately
      const clonedImg = cloned.find ? cloned.find("img")[0] : null;
      ed.select(clonedImg || cloned);
      markCurrentPageDirty();
    },
  });

  editor.Commands.add("smart-delete", {
    run(ed) {
      const selected = ed.getSelected();
      if (!selected) return;
      const target = resolveSmartImageActionTarget(selected);
      if (!target) return;
      target.remove();
      markCurrentPageDirty();
    },
  });

  editor.on("component:update", markCurrentPageDirty);
  editor.on("component:clone", (cloned) => {
    configureComponentGuardrails(cloned);
    markCurrentPageDirty();
  });
  editor.on("component:remove", markCurrentPageDirty);
}

// ============================================================================
// 4. Page Loading (With Shared Navbar/Footer Sync)
// ============================================================================
async function loadPageIntoCanvas(filename) {
  currentPageFile = filename;
  el.pageSelector.value = filename;
  suppressDirtyTracking = true;

  try {
    let draft = pageDrafts.get(filename);
    if (!draft) {
      const res = await fetch(`../${filename}`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fullHtml = await res.text();
      const { title, bodyHtml, scopedCss } = extractEditableBody(fullHtml);
      const normalized = normalizeExportedHtml(bodyHtml);

      // Seed shared navbar/footer from the first loaded page
      if (!sharedNavbarHtml || !sharedFooterHtml) {
        captureSharedChromeFromBody(normalized);
      }

      draft = {
        title,
        extraCss: PAGE_EXTRA_CSS[filename] || [],
        bodyHtml: normalized,
        scopedCss,
        dirty: false,
      };
      pageDrafts.set(filename, draft);
    }

    // Apply any site-wide navbar/footer edits made on other pages
    const syncedBody = sharedChromeDirty
      ? applySharedChromeToBody(draft.bodyHtml, filename)
      : draft.bodyHtml;
    const previewHtml = syncedBody.replace(/(src|srcset)="assets\//g, '$1="../assets/');

    editor.setComponents(previewHtml);
    editor.setStyle(draft.scopedCss || "");
    configureComponentGuardrails(editor.getWrapper());
    applyVariablesToCanvas();
  } catch (err) {
    alert(`تعذر تحميل الصفحة ${filename}: ${err.message}`);
  } finally {
    setTimeout(() => {
      suppressDirtyTracking = false;
    }, 60);
  }
}

// ============================================================================
// 5. Night/Dark & Light Theme Preview + css/variables.css Editor
// ============================================================================
function setCanvasTheme(theme) {
  activeThemeScope = theme === "light" ? "light" : "dark";
  el.tabDarkTheme.classList.toggle("is-active", activeThemeScope === "dark");
  el.tabLightTheme.classList.toggle("is-active", activeThemeScope === "light");
  el.canvasThemeToggleBtn.textContent =
    activeThemeScope === "dark" ? "🌙 الوضع الليلي" : "☀️ الوضع النهاري";

  renderThemeTokensPanel();
  applyVariablesToCanvas();
}

async function loadVariablesCss() {
  try {
    const res = await fetch("../css/variables.css", { cache: "no-cache" });
    if (!res.ok) return;
    variablesCssText = await res.text();
    renderThemeTokensPanel();
  } catch {
    // ignore
  }
}

function extractCssBlock(cssText, scope) {
  const regex =
    scope === "light"
      ? /\[data-theme="light"\]\s*\{([\s\S]*?)\}/
      : /:root(?:,\s*\[data-theme="dark"\])?\s*\{([\s\S]*?)\}/;
  const match = cssText.match(regex);
  return match ? match[1] : "";
}

function readTokenValue(scopeBlock, tokenName, fallback = "") {
  const re = new RegExp(`${tokenName}\\s*:\\s*([^;]+);`);
  const m = scopeBlock.match(re);
  return m ? m[1].trim() : fallback;
}

function updateCssToken(scope, tokenName, value) {
  const blockRegex =
    scope === "light"
      ? /(\[data-theme="light"\]\s*\{)([\s\S]*?)(\})/
      : /(:root(?:,\s*\[data-theme="dark"\])?\s*\{)([\s\S]*?)(\})/;

  variablesCssText = variablesCssText.replace(blockRegex, (_, open, body, close) => {
    const tokenRe = new RegExp(`(${tokenName}\\s*:\\s*)([^;]+)(;)`);
    if (tokenRe.test(body)) {
      return open + body.replace(tokenRe, `$1${value}$3`) + close;
    }
    return `${open}\n  ${tokenName}: ${value};${body}${close}`;
  });

  variablesCssDirty = true;
  applyVariablesToCanvas();
  updatePendingBadge();
}

function applyVariablesToCanvas() {
  const iframeDoc = editor?.Canvas?.getDocument?.();
  if (!iframeDoc) return;

  if (iframeDoc.documentElement) {
    iframeDoc.documentElement.setAttribute("lang", "ar");
    iframeDoc.documentElement.setAttribute("dir", "rtl");
    iframeDoc.documentElement.setAttribute("data-theme", activeThemeScope);
  }
  if (iframeDoc.body) {
    iframeDoc.body.setAttribute("data-theme", activeThemeScope);
  }

  let styleTag = iframeDoc.getElementById("studioLiveVariables");
  if (!styleTag) {
    styleTag = iframeDoc.createElement("style");
    styleTag.id = "studioLiveVariables";
    iframeDoc.head.appendChild(styleTag);
  }

  // Ensure GrapesJS iframe body accurately reflects Dark/Light theme and keeps sticky navbar non-overlapping
  const studioPreviewOverrides = `
    html, body {
      background-color: var(--bg-primary) !important;
      color: var(--text-primary) !important;
      direction: rtl !important;
    }
    nav.navbar {
      position: sticky !important;
      top: 0 !important;
    }
  `;
  styleTag.textContent = `${variablesCssText || ""}\n${studioPreviewOverrides}`;
}

function renderThemeTokensPanel() {
  if (!el.themeTokensContainer || !variablesCssText) return;
  const scopeBlock = extractCssBlock(variablesCssText, activeThemeScope);
  el.themeTokensContainer.innerHTML = "";

  const colorsHeader = document.createElement("div");
  colorsHeader.className = "studio-token-group-title";
  colorsHeader.textContent = "الألوان الأساسية (Solid Colors)";
  el.themeTokensContainer.appendChild(colorsHeader);

  SOLID_COLOR_TOKENS.forEach(({ token, label }) => {
    const currentVal = readTokenValue(scopeBlock, token, "#38bdf8");
    const hexMatch = currentVal.match(/^#[0-9a-fA-F]{6}$/);
    const colorVal = hexMatch ? hexMatch[0] : "#38bdf8";

    const row = document.createElement("div");
    row.className = "studio-token-row";

    const labelWrap = document.createElement("label");
    labelWrap.textContent = label;
    const codeEl = document.createElement("code");
    codeEl.textContent = token;
    labelWrap.appendChild(codeEl);

    const picker = document.createElement("input");
    picker.type = "color";
    picker.value = colorVal;
    picker.addEventListener("input", () => {
      updateCssToken(activeThemeScope, token, picker.value);
    });

    row.appendChild(labelWrap);
    row.appendChild(picker);
    el.themeTokensContainer.appendChild(row);
  });

  const gradsHeader = document.createElement("div");
  gradsHeader.className = "studio-token-group-title";
  gradsHeader.textContent = "التدرجات اللونية (Gradients)";
  el.themeTokensContainer.appendChild(gradsHeader);

  GRADIENT_TOKENS.forEach(({ token, label }) => {
    const currentVal = readTokenValue(scopeBlock, token, "linear-gradient(135deg, #60a5fa, #38bdf8)");

    const card = document.createElement("div");
    card.className = "studio-gradient-card";

    const header = document.createElement("div");
    header.className = "studio-gradient-header";
    header.innerHTML = `<span>${escapeHtml(label)}</span><code style="font-size:0.7rem;color:var(--studio-muted);direction:ltr">${token}</code>`;

    const swatch = document.createElement("div");
    swatch.className = "studio-gradient-swatch";
    swatch.style.background = currentVal;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "studio-gradient-input";
    input.value = currentVal;
    input.addEventListener("input", () => {
      const nextVal = input.value.trim();
      swatch.style.background = nextVal;
      if (nextVal) {
        updateCssToken(activeThemeScope, token, nextVal);
      }
    });

    card.appendChild(header);
    card.appendChild(swatch);
    card.appendChild(input);
    el.themeTokensContainer.appendChild(card);
  });
}

// ============================================================================
// 6. Single Pull Request Submission (Only Actually Modified Files)
// ============================================================================
async function prepareFilesForPr() {
  const files = [];
  for (const [filename, draft] of pageDrafts.entries()) {
    if (!draft.dirty) continue;
    const fullHtml = buildHtmlDocument({
      filename,
      title: draft.title,
      extraCss: draft.extraCss,
      bodyHtml: draft.bodyHtml,
      scopedCss: draft.scopedCss,
    });
    files.push({ path: filename, content: fullHtml, encoding: "utf-8" });
  }

  if (variablesCssDirty && variablesCssText) {
    files.push({ path: "css/variables.css", content: variablesCssText, encoding: "utf-8" });
  }

  for (const [assetPath, meta] of uploadedAssets.entries()) {
    files.push({ path: assetPath, content: meta.base64, encoding: "base64" });
  }

  return files;
}

function getPendingCountSync() {
  let count = 0;
  for (const draft of pageDrafts.values()) {
    if (draft.dirty) count++;
  }
  if (variablesCssDirty) count++;
  count += uploadedAssets.size;
  return count;
}

function updatePendingBadge() {
  const count = getPendingCountSync();
  el.pendingBadge.textContent = `${count} تعديلات معلقة`;
}

async function revertAllToOriginal() {
  if (!window.confirm("هل أنت متأكد من إلغاء جميع التعديلات والعودة للنسخة الأصلية؟")) {
    return;
  }
  pageDrafts.clear();
  uploadedAssets.clear();
  usedGoogleFonts.clear();
  sharedNavbarHtml = null;
  sharedFooterHtml = null;
  sharedChromeDirty = false;
  variablesCssDirty = false;
  pendingAiPreview = null;

  await loadVariablesCss();
  await loadPageIntoCanvas(currentPageFile);
  updatePendingBadge();
}

async function openSubmitPrModal() {
  el.prError.hidden = true;
  el.prResult.hidden = true;
  el.prFileList.textContent = "جاري تجهيز قائمة الملفات...";
  el.confirmPrBtn.disabled = true;
  el.submitPrModal.hidden = false;

  const files = await prepareFilesForPr();
  if (files.length === 0) {
    el.prFileList.textContent = "لا توجد تعديلات معلقة حالياً. عدّل نصًا أو صورة أو لونًا أولاً.";
    el.confirmPrBtn.disabled = true;
  } else {
    el.prFileList.innerHTML =
      "<strong>الملفات التي سيتم إرسالها في الـ PR:</strong><br>" +
      files.map((f) => `• <code>${escapeHtml(f.path)}</code>`).join("<br>");
    el.confirmPrBtn.disabled = false;
  }
}

async function submitPullRequest() {
  const files = await prepareFilesForPr();
  if (files.length === 0) return;

  el.prError.hidden = true;
  el.prResult.hidden = true;
  el.confirmPrBtn.disabled = true;
  el.confirmPrBtn.textContent = "جاري إنشاء Pull Request...";

  try {
    const res = await fetch(`${API_BASE}/api/cms/submit`, {
      method: "POST",
      credentials: "include",
      headers: getStudioAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        summary: el.prSummaryInput.value.trim() || `Update ${files.length} file(s) via Visual Studio`,
        files,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearStudioToken();
      el.submitPrModal.hidden = true;
      el.studioApp.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    for (const draft of pageDrafts.values()) draft.dirty = false;
    sharedChromeDirty = false;
    variablesCssDirty = false;
    uploadedAssets.clear();
    updatePendingBadge();

    el.prResult.innerHTML = `✅ تم إنشاء طلب المراجعة بنجاح (PR #${data.prNumber})!<br><a href="${escapeHtml(data.prUrl)}" target="_blank" rel="noopener noreferrer">افتح الـ Pull Request على GitHub للموافقة النهائية ←</a>`;
    el.prResult.hidden = false;
  } catch (err) {
    el.prError.textContent = err?.message || "فشل إرسال التعديلات.";
    el.prError.hidden = false;
  } finally {
    el.confirmPrBtn.disabled = false;
    el.confirmPrBtn.textContent = "إنشاء Pull Request";
  }
}

// ============================================================================
// 6B. Element Font Library (28 Google Fonts) & Smart Color Picker (Single vs All)
// ============================================================================
function rgbToHex(rgbStr) {
  if (!rgbStr) return null;
  if (/^#[0-9a-f]{6}$/i.test(rgbStr.trim())) return rgbStr.trim();
  const m = String(rgbStr).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!m) return null;
  const toHex = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}

function loadGoogleFontIntoCanvas(fontName) {
  if (!fontName) return;
  usedGoogleFonts.add(fontName);
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, "+")}:wght@400;500;600;700;800;900&display=swap`;
  const id = `gfont_${fontName.replace(/[^a-zA-Z0-9]/g, "_")}`;

  // Load into parent studio doc (for font dropdown preview)
  if (!document.getElementById(id)) {
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  // Load into GrapesJS canvas iframe
  const frameDoc = editor?.Canvas?.getDocument?.();
  if (frameDoc && !frameDoc.getElementById(id)) {
    const link = frameDoc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    frameDoc.head.appendChild(link);
  }
}

function renderFontLibraryOptions(filterText = "") {
  if (!el.fontFamilySelect) return;
  const q = String(filterText || "").trim().toLowerCase();
  const prev = el.fontFamilySelect.value;
  el.fontFamilySelect.innerHTML = "";

  GOOGLE_FONTS_LIBRARY.filter(
    (f) => !q || f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
  ).forEach((f) => {
    const opt = document.createElement("option");
    opt.value = f.name;
    opt.textContent = f.label;
    opt.style.fontFamily = `"${f.name}", sans-serif`;
    el.fontFamilySelect.appendChild(opt);
  });

  if (prev) el.fontFamilySelect.value = prev;
}

function getSelectedTargetsForScope(selected) {
  if (!selected) return [];
  if (styleApplyScope === "single") return [selected];

  const wrapper = editor?.getWrapper?.();
  if (!wrapper) return [selected];

  const classes = (selected.getClasses ? selected.getClasses() : []).filter(
    (c) => c && !c.startsWith("gjs-") && c !== "visible" && c !== "fade-in" && c !== "active"
  );
  const tag = String(selected.get("tagName") || "").toLowerCase();

  if (classes.length > 0) {
    const matches = wrapper.find(`.${classes[0]}`);
    if (matches && matches.length > 0) return matches;
  }
  if (tag) {
    const matches = wrapper.find(tag);
    if (matches && matches.length > 0) return matches;
  }
  return [selected];
}

function syncElementStyleInspector(comp) {
  if (!el.selectedElementBadge) return;
  if (!comp) {
    el.selectedElementBadge.textContent = "اضغط على أي عنصر في الصفحة لتعديل خطه أو ألوانه بسهولة";
    return;
  }

  const tag = String(comp.get("tagName") || "element").toLowerCase();
  const classes = (comp.getClasses ? comp.getClasses() : []).filter(
    (c) => c && !c.startsWith("gjs-") && c !== "visible"
  );
  const label = classes.length > 0 ? `<${tag}.${classes[0]}>` : `<${tag}>`;
  const allCount = getSelectedTargetsForScope(comp).length;
  el.selectedElementBadge.textContent =
    styleApplyScope === "all"
      ? `العنصر المحدد: ${label} — سيتم التطبيق على (${allCount}) عناصر مشابهة`
      : `العنصر المحدد: ${label} (تعديل هذا العنصر فقط)`;

  const viewEl = comp.getEl ? comp.getEl() : null;
  const win = editor?.Canvas?.getWindow?.();
  if (viewEl && win) {
    const cs = win.getComputedStyle(viewEl);
    const hexColor = rgbToHex(cs.color);
    const hexBg = rgbToHex(cs.backgroundColor);
    const hexBorder = rgbToHex(cs.borderColor);
    if (hexColor && el.elTextColorPicker) el.elTextColorPicker.value = hexColor;
    if (hexBg && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && el.elBgColorPicker) {
      el.elBgColorPicker.value = hexBg;
    }
    if (hexBorder && el.elBorderColorPicker) el.elBorderColorPicker.value = hexBorder;
    if (el.fontWeightSelect && cs.fontWeight) {
      el.fontWeightSelect.value = cs.fontWeight;
    }
  }
}

function applyStyleToSelection(styleObj) {
  const selected = editor?.getSelected?.();
  if (!selected) {
    alert("اختر عنصراً من الصفحة أولاً بالضغط عليه.");
    return;
  }
  const targets = getSelectedTargetsForScope(selected);
  targets.forEach((comp) => {
    comp.addStyle(styleObj);
  });
  // Trigger dirty tracking
  const normalized = normalizeExportedHtml(editor.getHtml());
  const existing = pageDrafts.get(currentPageFile) || {
    title: `Alexanders | ${currentPageFile}`,
    extraCss: PAGE_EXTRA_CSS[currentPageFile] || [],
  };
  existing.bodyHtml = normalized;
  existing.scopedCss = editor.getCss({ avoidProtected: true }) || "";
  existing.dirty = true;
  pageDrafts.set(currentPageFile, existing);
  updatePendingBadge();
}

function setStyleScope(scope) {
  styleApplyScope = scope === "all" ? "all" : "single";
  el.scopeSingleBtn?.classList.toggle("is-active", styleApplyScope === "single");
  el.scopeAllBtn?.classList.toggle("is-active", styleApplyScope === "all");
  if (el.scopeHintText) {
    el.scopeHintText.textContent =
      styleApplyScope === "all"
        ? "التغييرات ستُطبق على جميع العناصر المشابهة في الصفحة (نفس الفئة أو النوع)."
        : "التغييرات ستُطبق على العنصر المحدد فقط.";
  }
  syncElementStyleInspector(editor?.getSelected?.());
}

// ============================================================================
// 6C. Gemini Canvas Round-Trip Designer (Copy -> Design in Gemini -> Paste -> Preview -> PR)
// ============================================================================
let lastPreviewBlobUrl = null;

async function copyTextToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

function openPreviewHtmlInNewTab(htmlString) {
  if (!htmlString) return;
  try {
    if (lastPreviewBlobUrl) {
      URL.revokeObjectURL(lastPreviewBlobUrl);
      lastPreviewBlobUrl = null;
    }
    const blob = new Blob([htmlString], { type: "text/html; charset=utf-8" });
    lastPreviewBlobUrl = URL.createObjectURL(blob);
    window.open(lastPreviewBlobUrl, "_blank", "noopener");
  } catch {
    // Fallback if browser blocks blob tab
  }
}

async function copyAndOpenGeminiCanvas() {
  if (!el.copyAndOpenGeminiBtn) return;
  el.geminiCopyStatus.hidden = true;
  el.copyAndOpenGeminiBtn.disabled = true;
  el.copyAndOpenGeminiBtn.textContent = "جاري تجهيز ونسخ الكود...";

  try {
    const siteOrigin = window.location.origin; // e.g. https://alexfa.me
    const liveBody = normalizeExportedHtml(editor.getHtml());
    const liveCss = editor.getCss({ avoidProtected: true }) || "";
    const draft = pageDrafts.get(currentPageFile) || {
      title: `Alexanders | ${currentPageFile}`,
      extraCss: PAGE_EXTRA_CSS[currentPageFile] || [],
    };

    const fullHtml = buildHtmlDocument({
      filename: currentPageFile,
      title: draft.title,
      extraCss: draft.extraCss,
      bodyHtml: liveBody,
      scopedCss: liveCss,
    });

    // Convert relative assets/ & css/ & js/ URLs to absolute https://alexfa.me/... URLs
    // so every image and stylesheet renders live inside Gemini Canvas!
    const canvasReadyHtml = fullHtml
      .replace(/(href|src|srcset)="(assets\/|css\/|js\/|favicon\.webp)/g, `$1="${siteOrigin}/$2`);

    const userReq = (el.geminiRequestInput?.value || "").trim();
    const modeNote =
      aiChangeMode === "drastic"
        ? "Mode: DRASTIC REDESIGN — feel free to boldly redesign the layout, sections, typography, and colors while keeping Arabic RTL and mobile responsiveness."
        : "Mode: MINIMAL / CONSERVATIVE — make clean, focused improvements while preserving the existing structure and branding.";

    const promptBundle = [
      `Please open this page (${currentPageFile}) in Gemini Canvas so I can preview and edit it live.`,
      modeNote,
      userReq ? `My requested changes: ${userReq}` : "Wait for my design edits or suggest visual improvements.",
      `Important rules for the final HTML:`,
      `- Keep all existing image/CSS URLs pointing to ${siteOrigin}/... so images render in Canvas.`,
      `- Keep dir="rtl" and Arabic Cairo/Poppins fonts.`,
      `- When I'm done, provide the complete updated HTML document so I can copy it back into my website.`,
      "",
      "```html",
      canvasReadyHtml,
      "```",
    ].join("\n");

    const copied = await copyTextToClipboard(promptBundle);
    window.open("https://gemini.google.com/app", "_blank", "noopener");

    el.geminiCopyStatus.textContent = copied
      ? "✅ تم نسخ كود الصفحة بالكامل وفتح Gemini! فعّل وضع Canvas واضغط لصق (Ctrl+V)."
      : "تم فتح Gemini — إذا لم يُنسخ تلقائياً، اسمح بصلاحية الحافظة وحاول مجدداً.";
    el.geminiCopyStatus.hidden = false;
  } finally {
    el.copyAndOpenGeminiBtn.disabled = false;
    el.copyAndOpenGeminiBtn.textContent = "📋 نسخ الكود وفتح Gemini Canvas ↗️";
  }
}

function cleanGeminiPastedHtml(rawPasted) {
  let html = String(rawPasted || "").trim();
  // Strip optional markdown code fences (```html ... ```)
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/i, "").trim();

  if (!html || (!html.includes("<") && !html.includes(">"))) {
    throw new Error("يرجى لصق كود HTML صالح من Gemini Canvas أولاً.");
  }

  // Convert absolute site URLs back to clean relative repo paths
  const siteOriginEscaped = window.location.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const absRegex = new RegExp(`(href|src|srcset)="${siteOriginEscaped}/(assets/|css/|js/|favicon\\.webp|chat-widget\\.(?:js|css))`, "gi");
  html = html.replace(absRegex, '$1="$2');
  // Also normalize hardcoded https://alexfa.me/ if copied from another origin
  html = html.replace(
    /(href|src|srcset)="https?:\/\/(?:www\.)?alexfa\.me\/(assets\/|css\/|js\/|favicon\.webp|chat-widget\.(?:js|css))/gi,
    '$1="$2'
  );
  // Strip any temporary <base ...> tag
  html = html.replace(/<base\b[^>]*>/gi, "");

  // If user pasted only body fragment instead of full <!DOCTYPE html>, wrap it cleanly
  if (!/<html[\s>]/i.test(html)) {
    const draft = pageDrafts.get(currentPageFile) || {
      title: `Alexanders | ${currentPageFile}`,
      extraCss: PAGE_EXTRA_CSS[currentPageFile] || [],
    };
    html = buildHtmlDocument({
      filename: currentPageFile,
      title: draft.title,
      extraCss: draft.extraCss,
      bodyHtml: html,
      scopedCss: "",
    });
  }

  return html;
}

function applyGeminiImportedHtmlToSamePage() {
  el.geminiImportError.hidden = true;
  if (el.geminiImportSuccess) el.geminiImportSuccess.hidden = true;

  try {
    const cleanedFullHtml = cleanGeminiPastedHtml(el.geminiImportTextarea?.value);

    // Parse full HTML and collect ALL <style> tags (so Gemini Canvas's custom CSS reflects immediately!)
    const parser = new DOMParser();
    const doc = parser.parseFromString(cleanedFullHtml, "text/html");
    const title = doc.querySelector("title")?.textContent?.trim() || `Alexanders | ${currentPageFile}`;

    // Load any Google Fonts stylesheets Gemini added into the live canvas iframe
    const frameDoc = editor?.Canvas?.getDocument?.();
    doc.querySelectorAll('link[rel="stylesheet"]').forEach((lnk) => {
      const href = lnk.getAttribute("href") || "";
      if (href.includes("fonts.googleapis.com") && frameDoc) {
        if (!Array.from(frameDoc.querySelectorAll("link")).some((l) => l.getAttribute("href") === href)) {
          const newLink = frameDoc.createElement("link");
          newLink.rel = "stylesheet";
          newLink.href = href;
          frameDoc.head.appendChild(newLink);
        }
      }
    });

    const allCssChunks = [];
    doc.querySelectorAll("style").forEach((st) => {
      const txt = (st.textContent || "").trim();
      if (txt) allCssChunks.push(txt);
      st.remove();
    });
    const combinedScopedCss = allCssChunks.join("\n\n");

    doc.body.querySelectorAll("script, noscript").forEach((n) => n.remove());
    doc.body
      .querySelectorAll(".fade-in, .fade-in-left, .fade-in-right, .stagger-children")
      .forEach((n) => n.classList.add("visible"));

    const normalizedBody = normalizeExportedHtml(doc.body.innerHTML);
    const previewBody = normalizedBody.replace(/(src|srcset)="assets\//g, '$1="../assets/');

    // Save draft for PR submission
    pageDrafts.set(currentPageFile, {
      title,
      extraCss: PAGE_EXTRA_CSS[currentPageFile] || [],
      bodyHtml: normalizedBody,
      scopedCss: combinedScopedCss,
      dirty: true,
    });

    // Reflect changes immediately on the SAME Studio canvas page!
    suppressDirtyTracking = true;
    editor.setComponents(previewBody);
    editor.setStyle(combinedScopedCss);
    configureComponentGuardrails(editor.getWrapper());
    applyVariablesToCanvas();
    setTimeout(() => {
      suppressDirtyTracking = false;
    }, 80);

    // Pre-fill PR summary if user entered one
    const customSummary = (el.geminiPrSummaryInput?.value || "").trim();
    if (customSummary && el.prSummaryInput && !el.prSummaryInput.value.trim()) {
      el.prSummaryInput.value = customSummary;
    }

    updatePendingBadge();
    if (el.geminiImportSuccess) {
      el.geminiImportSuccess.textContent =
        "✅ تم تطبيق التعديلات مباشرة على الصفحة! راجعها هنا أو اضغط (🚀 إرسال للمراجعة PR) أو (↺ العودة للأصل).";
      el.geminiImportSuccess.hidden = false;
    }
  } catch (err) {
    el.geminiImportError.textContent = err?.message || "تعذر قراءة كود HTML.";
    el.geminiImportError.hidden = false;
  }
}

// ============================================================================
// 7. Bootstrap & Event Wiring
// ============================================================================
async function enterStudio() {
  el.loginOverlay.hidden = true;
  el.studioApp.hidden = false;

  if (!editor) {
    renderFontLibraryOptions();
    initGrapesEditor();
    await loadVariablesCss();
    await loadPageIntoCanvas(el.pageSelector.value || "index.html");
  }
}

function wireEvents() {
  el.loginForm.addEventListener("submit", handleLoginSubmit);
  el.logoutBtn.addEventListener("click", handleLogout);

  el.pageSelector.addEventListener("change", () => loadPageIntoCanvas(el.pageSelector.value));

  el.deviceDesktopBtn.addEventListener("click", () => {
    editor?.setDevice("Desktop");
    el.deviceDesktopBtn.classList.add("is-active");
    el.deviceMobileBtn.classList.remove("is-active");
  });

  el.deviceMobileBtn.addEventListener("click", () => {
    editor?.setDevice("Mobile");
    el.deviceMobileBtn.classList.add("is-active");
    el.deviceDesktopBtn.classList.remove("is-active");
  });

  el.canvasThemeToggleBtn.addEventListener("click", () => {
    setCanvasTheme(activeThemeScope === "dark" ? "light" : "dark");
  });

  el.undoBtn.addEventListener("click", () => editor?.UndoManager?.undo());
  el.redoBtn.addEventListener("click", () => editor?.UndoManager?.redo());
  el.revertOriginalBtn.addEventListener("click", revertAllToOriginal);

  // Drawer A: Element Style & Site Theme
  el.styleDrawerBtn.addEventListener("click", () => {
    const opening = el.themeDrawer.hidden;
    el.themeDrawer.hidden = !opening;
    el.styleDrawerBtn.classList.toggle("is-active", opening);
    if (opening) {
      el.aiDrawer.hidden = true;
      el.aiDrawerBtn.classList.remove("is-active");
      syncElementStyleInspector(editor?.getSelected?.());
    }
  });
  el.closeThemeDrawerBtn.addEventListener("click", () => {
    el.themeDrawer.hidden = true;
    el.styleDrawerBtn.classList.remove("is-active");
  });

  el.tabElementStyle.addEventListener("click", () => {
    el.tabElementStyle.classList.add("is-active");
    el.tabSiteTheme.classList.remove("is-active");
    el.elementStylePanel.hidden = false;
    el.siteThemePanel.hidden = true;
  });
  el.tabSiteTheme.addEventListener("click", () => {
    el.tabSiteTheme.classList.add("is-active");
    el.tabElementStyle.classList.remove("is-active");
    el.elementStylePanel.hidden = true;
    el.siteThemePanel.hidden = false;
  });

  el.scopeSingleBtn.addEventListener("click", () => setStyleScope("single"));
  el.scopeAllBtn.addEventListener("click", () => setStyleScope("all"));

  el.fontSearchInput.addEventListener("input", () => {
    renderFontLibraryOptions(el.fontSearchInput.value);
  });
  el.fontFamilySelect.addEventListener("change", () => {
    const fontName = el.fontFamilySelect.value;
    if (!fontName) return;
    loadGoogleFontIntoCanvas(fontName);
    applyStyleToSelection({ "font-family": `"${fontName}", sans-serif` });
  });
  el.fontWeightSelect.addEventListener("change", () => {
    const w = el.fontWeightSelect.value;
    if (!w) return;
    applyStyleToSelection({ "font-weight": w });
  });

  el.elTextColorPicker.addEventListener("input", () => {
    applyStyleToSelection({ color: el.elTextColorPicker.value });
  });
  el.elBgColorPicker.addEventListener("input", () => {
    applyStyleToSelection({ "background-color": el.elBgColorPicker.value });
  });
  el.elBorderColorPicker.addEventListener("input", () => {
    applyStyleToSelection({ "border-color": el.elBorderColorPicker.value });
  });
  el.clearTextColorBtn.addEventListener("click", () => applyStyleToSelection({ color: "" }));
  el.clearBgColorBtn.addEventListener("click", () => applyStyleToSelection({ "background-color": "" }));
  el.clearBorderColorBtn.addEventListener("click", () => applyStyleToSelection({ "border-color": "" }));

  el.tabDarkTheme.addEventListener("click", () => setCanvasTheme("dark"));
  el.tabLightTheme.addEventListener("click", () => setCanvasTheme("light"));

  // Drawer B: Gemini Canvas Round-Trip Designer
  el.aiDrawerBtn.addEventListener("click", () => {
    const opening = el.aiDrawer.hidden;
    el.aiDrawer.hidden = !opening;
    el.aiDrawerBtn.classList.toggle("is-active", opening);
    if (opening) {
      el.themeDrawer.hidden = true;
      el.styleDrawerBtn.classList.remove("is-active");
    }
  });
  el.closeAiDrawerBtn.addEventListener("click", () => {
    el.aiDrawer.hidden = true;
    el.aiDrawerBtn.classList.remove("is-active");
  });
  el.aiModeMinimalBtn.addEventListener("click", () => {
    aiChangeMode = "minimal";
    el.aiModeMinimalBtn.classList.add("is-active");
    el.aiModeDrasticBtn.classList.remove("is-active");
  });
  el.aiModeDrasticBtn.addEventListener("click", () => {
    aiChangeMode = "drastic";
    el.aiModeDrasticBtn.classList.add("is-active");
    el.aiModeMinimalBtn.classList.remove("is-active");
  });
  el.copyAndOpenGeminiBtn.addEventListener("click", copyAndOpenGeminiCanvas);
  el.previewGeminiImportBtn.addEventListener("click", applyGeminiImportedHtmlToSamePage);

  // Manual PR Modal
  el.submitPrBtn.addEventListener("click", openSubmitPrModal);
  el.cancelPrBtn.addEventListener("click", () => {
    el.submitPrModal.hidden = true;
  });
  el.confirmPrBtn.addEventListener("click", submitPullRequest);
}

async function boot() {
  wireEvents();
  const isAuthenticated = await checkSession();
  if (isAuthenticated) {
    await enterStudio();
  } else {
    el.loginOverlay.hidden = false;
    el.studioApp.hidden = true;
  }
}

boot();
