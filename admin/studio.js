// ============================================================================
// Alexanders Visual Studio — Focused 4-Capability Editor
// 1. Inline Text Editing (double-click any text; no accidental drag-repositioning)
// 2. Image Replacement (click/double-click any <img> -> Asset Manager + <picture> sync)
// 3. Duplicate & Delete Any Element (minimal component toolbar only)
// 4. Theme Colors & Gradients (live css/variables.css editor for Dark & Light themes)
// ============================================================================

const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
const API_BASE =
  typeof window !== "undefined" && typeof window.ALEXANDERS_CMS_API_BASE === "string"
    ? window.ALEXANDERS_CMS_API_BASE
    : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
      ? ""
      : DEFAULT_WORKER_ORIGIN;

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

// Curated semantic labels for solid color & gradient variables in css/variables.css
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

const pageDrafts = new Map(); // filename -> { title, extraCss, bodyHtml, scopedCss, dirty }
const uploadedAssets = new Map(); // "assets/pc/name.ext" -> { base64, dataUrl }

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
  undoBtn: document.getElementById("undoBtn"),
  redoBtn: document.getElementById("redoBtn"),
  themePanelBtn: document.getElementById("themePanelBtn"),
  pendingBadge: document.getElementById("pendingBadge"),
  submitPrBtn: document.getElementById("submitPrBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  themeDrawer: document.getElementById("themeDrawer"),
  closeThemeDrawerBtn: document.getElementById("closeThemeDrawerBtn"),
  tabDarkTheme: document.getElementById("tabDarkTheme"),
  tabLightTheme: document.getElementById("tabLightTheme"),
  themeTokensContainer: document.getElementById("themeTokensContainer"),
  submitPrModal: document.getElementById("submitPrModal"),
  prSummaryInput: document.getElementById("prSummaryInput"),
  prFileList: document.getElementById("prFileList"),
  prError: document.getElementById("prError"),
  prResult: document.getElementById("prResult"),
  cancelPrBtn: document.getElementById("cancelPrBtn"),
  confirmPrBtn: document.getElementById("confirmPrBtn"),
};

// ============================================================================
// 1. Worker Authentication Gate
// ============================================================================
async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/cms/session`, {
      method: "GET",
      credentials: "include",
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
// 2. Locked RTL HTML Shell & Chrome Stripping
// ============================================================================
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildLockedHtmlShell({ filename, title, extraCss = [], bodyHtml, scopedCss = "" }) {
  const navActive = (href) => (filename === href ? ' class="active"' : "");
  const extraCssLinks = extraCss
    .map((href) => `  <link rel="stylesheet" href="${href}">`)
    .join("\n");
  const scopedStyleBlock = scopedCss.trim()
    ? `\n  <style data-cms-scoped="true">\n${scopedCss.trim()}\n  </style>`
    : "";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="favicon.webp" type="image/webp">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Poppins:wght@600;700;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/variables.css">
  <link rel="stylesheet" href="css/style.css">${extraCssLinks ? "\n" + extraCssLinks : ""}${scopedStyleBlock}
</head>
<body>

  <!-- Locked Navbar -->
  <nav class="navbar">
    <div class="container">
      <a href="index.html" class="navbar-logo">
        <picture>
          <source media="(max-width: 768px)" srcset="assets/mobile/logo-DX3b3OH2.webp">
          <img src="assets/pc/logo-DX3b3OH2.webp" alt="Alexanders Logo" width="1080" height="1080">
        </picture>
      </a>
      <div class="navbar-links">
        <a href="index.html"${navActive("index.html")}>الرئيسية</a>
        <a href="about.html"${navActive("about.html")}>من نحن</a>
        <a href="story.html"${navActive("story.html")}>قصتنا</a>
        <a href="honor.html"${navActive("honor.html")}>المساهمون</a>
        <a href="gallery.html"${navActive("gallery.html")}>المعرض</a>
      </div>
      <div class="navbar-actions">
        <button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle theme">
          <div class="toggle-track">
            <div class="toggle-dot">
              <span class="icon-moon">🌙</span>
              <span class="icon-sun">☀️</span>
            </div>
          </div>
        </button>
        <button class="hamburger" aria-label="Menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </div>
  </nav>

${bodyHtml.trim()}

  <!-- Locked Footer -->
  <footer class="footer">
    <div class="container">
      <div class="footer-brand">
        <div class="brand-header">
          <picture>
            <source media="(max-width: 768px)" srcset="assets/mobile/logo-DX3b3OH2.webp">
            <img src="assets/pc/logo-DX3b3OH2.webp" alt="Alexanders" loading="lazy" decoding="async" width="1080" height="1080">
          </picture>
          <span>ALEXANDERS</span>
        </div>
        <p>مجتمع ثقفى يجمع بين روح الفن الكلاسيكي والإبداع التكنولوجي. نُلهم، نُعلّم، ونبني الجيل القادم من المبدعين.</p>
        <div class="footer-socials">
          <a href="https://www.youtube.com/@alexandersgroup" aria-label="YouTube">▶</a>
          <a href="https://www.linkedin.com/company/alexanders-group/posts/" aria-label="LinkedIn">in</a>
          <a href="https://www.facebook.com/profile.php?id=61573564592001" aria-label="Facebook">f</a>
          <a href="https://www.tiktok.com/@alexanders.groupp" aria-label="TikTok">♪</a>
        </div>
      </div>
      <div class="footer-links-group">
        <h4>روابط</h4>
        <a href="about.html">من نحن</a>
        <a href="story.html">قصة اليكساندرز</a>
        <a href="honor.html">المساهمون في الموقع</a>
        <a href="gallery.html">المعرض</a>
        <a href="index.html#committees">اللجان</a>
        <a href="join.html">انضم إلينا</a>
      </div>
    </div>
    <div class="container">
      <div class="footer-bottom">
        <span class="copyright">© All Rights Reserved by Alexanders 2026</span>
      </div>
    </div>
  </footer>

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

function stripLockedChrome(fullHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() || "Alexanders";
  const scopedStyle = doc.querySelector('style[data-cms-scoped="true"]')?.textContent || "";

  doc.body.querySelectorAll("nav.navbar, footer.footer, script, noscript").forEach((node) => node.remove());

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

// ============================================================================
// 3. Focused GrapesJS Setup: Inline Text, Image Swap, Duplicate & Delete Only
// ============================================================================
function configureComponentGuardrails(component) {
  if (!component) return;
  const tag = String(component.get("tagName") || "").toLowerCase();
  const classes = component.getClasses ? component.getClasses() : [];

  // Lock accidental drag/drop repositioning so layout never breaks
  component.set({
    draggable: false,
    droppable: false,
    resizable: false,
    copyable: true,
    removable: true,
  });

  // Enable intuitive double-click inline editing on text elements
  const isTextLike =
    TEXT_TAGS.has(tag) || classes.some((cls) => TEXT_CLASSES.includes(cls));
  if (isTextLike && tag !== "img" && tag !== "picture") {
    component.set({ editable: true });
  }

  // Minimal toolbar: Select Parent, Duplicate, Delete (plus Swap Image for <img>)
  const toolbar = [
    {
      attributes: { class: "fa fa-arrow-up", title: "تحديد العنصر الأب (البطاقة/القسم)" },
      command: "select-parent",
    },
    {
      attributes: { class: "fa fa-clone", title: "تكرار العنصر (Duplicate)" },
      command: "tlb-clone",
    },
    {
      attributes: { class: "fa fa-trash-o", title: "حذف العنصر (Delete)" },
      command: "tlb-delete",
    },
  ];

  if (tag === "img") {
    toolbar.unshift({
      attributes: { class: "fa fa-picture-o", title: "تغيير الصورة (Swap Image)" },
      command: "open-assets",
    });
  }

  component.set({ toolbar });

  // Recurse into children
  const children = component.components ? component.components() : null;
  if (children && children.length) {
    children.forEach((child) => configureComponentGuardrails(child));
  }
}

/**
 * When an <img> src changes inside a <picture>, remove any stale mobile <source>
 * so the new image immediately displays on both desktop and mobile (the PR workflow
 * auto-generates the fresh 480px WebP mobile variant on commit).
 */
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

function initGrapesEditor() {
  editor = window.grapesjs.init({
    container: "#gjs",
    height: "100%",
    width: "auto",
    storageManager: false,
    fromElement: false,
    panels: { defaults: [] }, // Hide all heavy default panels (Blocks, Style Manager, Layers, Code)
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

            // Immediately apply the uploaded image if an <img> is currently selected
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

  // Enforce RTL & active theme inside GrapesJS iframe
  editor.on("load", () => {
    const iframeDoc = editor.Canvas.getDocument();
    if (iframeDoc?.documentElement) {
      iframeDoc.documentElement.setAttribute("lang", "ar");
      iframeDoc.documentElement.setAttribute("dir", "rtl");
      iframeDoc.documentElement.setAttribute("data-theme", activeThemeScope);
    }
    applyVariablesToCanvas();
  });

  // Apply guardrails on newly loaded or duplicated components
  editor.on("component:add", (comp) => configureComponentGuardrails(comp));

  // Clicking an <img> opens Asset Manager directly for fast 1-click image swap
  editor.on("component:selected", (comp) => {
    configureComponentGuardrails(comp);
  });

  editor.on("component:update:src", (comp) => {
    syncPictureSourceOnImageSwap(comp);
    markCurrentPageDirty();
  });

  // Open Asset Manager when clicking an image's "Swap Image" or double-clicking any <img>
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
    existing.bodyHtml = normalizeExportedHtml(editor.getHtml());
    existing.scopedCss = editor.getCss({ avoidProtected: true }) || "";
    existing.dirty = true;
    pageDrafts.set(currentPageFile, existing);
    updatePendingBadge();
  };

  editor.on("component:update", markCurrentPageDirty);
  editor.on("component:clone", (cloned) => {
    configureComponentGuardrails(cloned);
    markCurrentPageDirty();
  });
  editor.on("component:remove", markCurrentPageDirty);
}

// ============================================================================
// 4. Page Loading
// ============================================================================
async function loadPageIntoCanvas(filename) {
  currentPageFile = filename;
  el.pageSelector.value = filename;
  suppressDirtyTracking = true;

  try {
    if (pageDrafts.has(filename)) {
      const draft = pageDrafts.get(filename);
      const previewHtml = draft.bodyHtml.replace(/(src|srcset)="assets\//g, '$1="../assets/');
      editor.setComponents(previewHtml);
      editor.setStyle(draft.scopedCss || "");
    } else {
      const res = await fetch(`../${filename}`, { cache: "no-cache" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fullHtml = await res.text();
      const { title, bodyHtml, scopedCss } = stripLockedChrome(fullHtml);

      pageDrafts.set(filename, {
        title,
        extraCss: PAGE_EXTRA_CSS[filename] || [],
        bodyHtml: normalizeExportedHtml(bodyHtml),
        scopedCss,
        dirty: false,
      });

      editor.setComponents(bodyHtml);
      editor.setStyle(scopedCss);
    }

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
// 5. Theme Colors & Gradients Editor (css/variables.css)
// ============================================================================
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
      : /:root\s*\{([\s\S]*?)\}/;
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
      : /(:root\s*\{)([\s\S]*?)(\})/;

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
    iframeDoc.documentElement.setAttribute("data-theme", activeThemeScope);
  }
  if (!variablesCssText) return;
  let styleTag = iframeDoc.getElementById("studioLiveVariables");
  if (!styleTag) {
    styleTag = iframeDoc.createElement("style");
    styleTag.id = "studioLiveVariables";
    iframeDoc.head.appendChild(styleTag);
  }
  styleTag.textContent = variablesCssText;
}

function renderThemeTokensPanel() {
  if (!el.themeTokensContainer || !variablesCssText) return;
  const scopeBlock = extractCssBlock(variablesCssText, activeThemeScope);
  el.themeTokensContainer.innerHTML = "";

  // 1. Solid Colors Section
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

  // 2. Gradients Section (with live swatch preview)
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
// 6. Single Pull Request Submission (POST /api/cms/submit)
// ============================================================================
function collectPendingFiles() {
  const files = [];

  for (const [filename, draft] of pageDrafts.entries()) {
    if (!draft.dirty) continue;
    const fullHtml = buildLockedHtmlShell({
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

function updatePendingBadge() {
  const count = collectPendingFiles().length;
  el.pendingBadge.textContent = `${count} تعديلات معلقة`;
}

function openSubmitPrModal() {
  const files = collectPendingFiles();
  el.prError.hidden = true;
  el.prResult.hidden = true;

  if (files.length === 0) {
    el.prFileList.textContent = "لا توجد تعديلات معلقة حالياً. عدّل نصًا أو صورة أو لونًا أولاً.";
    el.confirmPrBtn.disabled = true;
  } else {
    el.prFileList.innerHTML =
      "<strong>الملفات التي سيتم إرسالها في الـ PR:</strong><br>" +
      files.map((f) => `• <code>${escapeHtml(f.path)}</code>`).join("<br>");
    el.confirmPrBtn.disabled = false;
  }

  el.submitPrModal.hidden = false;
}

async function submitPullRequest() {
  const files = collectPendingFiles();
  if (files.length === 0) return;

  el.prError.hidden = true;
  el.prResult.hidden = true;
  el.confirmPrBtn.disabled = true;
  el.confirmPrBtn.textContent = "جاري إنشاء Pull Request...";

  try {
    const res = await fetch(`${API_BASE}/api/cms/submit`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: el.prSummaryInput.value.trim() || `Update ${files.length} file(s) via Visual Studio`,
        files,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      el.submitPrModal.hidden = true;
      el.studioApp.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    for (const draft of pageDrafts.values()) draft.dirty = false;
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
// 7. Bootstrap & Event Wiring
// ============================================================================
async function enterStudio() {
  el.loginOverlay.hidden = true;
  el.studioApp.hidden = false;

  if (!editor) {
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

  el.undoBtn.addEventListener("click", () => editor?.UndoManager?.undo());
  el.redoBtn.addEventListener("click", () => editor?.UndoManager?.redo());

  el.themePanelBtn.addEventListener("click", () => {
    el.themeDrawer.hidden = !el.themeDrawer.hidden;
    el.themePanelBtn.classList.toggle("is-active", !el.themeDrawer.hidden);
  });
  el.closeThemeDrawerBtn.addEventListener("click", () => {
    el.themeDrawer.hidden = true;
    el.themePanelBtn.classList.remove("is-active");
  });

  el.tabDarkTheme.addEventListener("click", () => {
    activeThemeScope = "dark";
    el.tabDarkTheme.classList.add("is-active");
    el.tabLightTheme.classList.remove("is-active");
    renderThemeTokensPanel();
    applyVariablesToCanvas();
  });

  el.tabLightTheme.addEventListener("click", () => {
    activeThemeScope = "light";
    el.tabLightTheme.classList.add("is-active");
    el.tabDarkTheme.classList.remove("is-active");
    renderThemeTokensPanel();
    applyVariablesToCanvas();
  });

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
