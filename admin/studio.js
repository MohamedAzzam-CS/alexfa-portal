// ============================================================================
// Alexanders Visual Studio — GrapesJS Visual CMS Controller
// - Protected via Cloudflare Worker session cookie (/api/cms/session|login|logout)
// - Strips & locks outer chrome (.navbar, .footer, theme toggle, chat loader)
// - Exports clean pages wrapped in the locked RTL Arabic HTML shell
// - Submits all edited/new pages, css/variables.css, and uploaded assets/pc/*
//   in a single GitHub Pull Request via POST /api/cms/submit
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

// State
let editor = null;
let currentPageFile = "index.html";
let variablesCssText = "";
let variablesCssDirty = false;
const pageDrafts = new Map(); // filename -> { title, extraCss, bodyHtml, scopedCss, isNew }
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
  newPageBtn: document.getElementById("newPageBtn"),
  linkPickerBtn: document.getElementById("linkPickerBtn"),
  themePanelBtn: document.getElementById("themePanelBtn"),
  pendingBadge: document.getElementById("pendingBadge"),
  submitPrBtn: document.getElementById("submitPrBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  themeDrawer: document.getElementById("themeDrawer"),
  closeThemeDrawerBtn: document.getElementById("closeThemeDrawerBtn"),
  tokenFontPrimary: document.getElementById("tokenFontPrimary"),
  tokenFontDisplay: document.getElementById("tokenFontDisplay"),
  newPageModal: document.getElementById("newPageModal"),
  newPageTitle: document.getElementById("newPageTitle"),
  newPageSlug: document.getElementById("newPageSlug"),
  cancelNewPageBtn: document.getElementById("cancelNewPageBtn"),
  confirmNewPageBtn: document.getElementById("confirmNewPageBtn"),
  linkPickerModal: document.getElementById("linkPickerModal"),
  linkTargetType: document.getElementById("linkTargetType"),
  linkPageGroup: document.getElementById("linkPageGroup"),
  linkPageSelect: document.getElementById("linkPageSelect"),
  linkAnchorGroup: document.getElementById("linkAnchorGroup"),
  linkAnchorSelect: document.getElementById("linkAnchorSelect"),
  linkExternalGroup: document.getElementById("linkExternalGroup"),
  linkExternalInput: document.getElementById("linkExternalInput"),
  cancelLinkPickerBtn: document.getElementById("cancelLinkPickerBtn"),
  applyLinkBtn: document.getElementById("applyLinkBtn"),
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

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Extracts only the editable body sections from a full site HTML page,
 * stripping locked chrome (.navbar, .footer, scripts).
 */
function stripLockedChrome(fullHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(fullHtml, "text/html");
  const title = doc.querySelector("title")?.textContent?.trim() || "Alexanders";
  const scopedStyle = doc.querySelector('style[data-cms-scoped="true"]')?.textContent || "";

  // Remove locked outer chrome & scripts before loading into visual canvas
  doc.body.querySelectorAll("nav.navbar, footer.footer, script, noscript").forEach((node) => node.remove());

  // Make scroll-reveal elements immediately visible inside the editor canvas
  doc.body
    .querySelectorAll(".fade-in, .fade-in-left, .fade-in-right, .stagger-children")
    .forEach((node) => node.classList.add("visible"));

  // Rewrite relative asset paths to ../assets/ for preview inside /admin/studio.html
  let bodyHtml = doc.body.innerHTML.replace(/(src|srcset)="assets\//g, '$1="../assets/');
  return { title, bodyHtml, scopedCss: scopedStyle };
}

/**
 * Normalizes exported editor HTML back to root-relative paths (assets/...)
 * and replaces any inline dataURLs with their committed assets/pc/... path.
 */
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
// 3. GrapesJS Initialization & Design System Section Blocks
// ============================================================================
function registerDesignSystemBlocks(gjsEditor) {
  const bm = gjsEditor.BlockManager;

  bm.add("alex-page-hero", {
    label: "مقدمة صفحة (Hero)",
    category: "أقسام ألكساندرز",
    content: `
      <section class="page-hero">
        <div class="container">
          <div class="fade-in visible">
            <span class="section-label">قسم جديد</span>
            <h1>عنوان <span class="highlight">مميز</span> هنا</h1>
            <p>أضف وصفًا موجزًا للصفحة أو الفعالية الجديدة باللغة العربية.</p>
          </div>
        </div>
      </section>
    `,
  });

  bm.add("alex-timeline-item", {
    label: "محطة قصة (Timeline)",
    category: "أقسام ألكساندرز",
    content: `
      <div class="timeline-item fade-in visible">
        <div class="timeline-dot"></div>
        <div class="timeline-image" style="position: relative;">
          <img src="../assets/pc/STR1-DBpUT5aE.webp" alt="محطة جديدة" loading="lazy" decoding="async">
          <span class="image-label">عنوان المحطة</span>
        </div>
        <div class="timeline-text">
          <div class="text-bubble">اكتب تفاصيل هذه المحطة المهمة في رحلة ألكساندرز هنا.</div>
        </div>
      </div>
    `,
  });

  bm.add("alex-honor-card", {
    label: "بطاقة مساهم (Honor)",
    category: "أقسام ألكساندرز",
    content: `
      <article class="honor-card">
        <div class="honor-photo">
          <img src="../assets/pc/logo-DX3b3OH2.webp" alt="اسم المساهم" loading="lazy" decoding="async">
        </div>
        <div class="honor-body">
          <span class="honor-title">Committee Role</span>
          <h3 class="honor-name">الاسم الكامل</h3>
          <p class="honor-committee">اسم اللجنة</p>
        </div>
      </article>
    `,
  });

  bm.add("alex-activity-card", {
    label: "بطاقة فعالية (Activity)",
    category: "أقسام ألكساندرز",
    content: `
      <div class="activity-card">
        <div class="card-image">
          <img src="../assets/pc/post-1-CZpH6_hv.webp" alt="فعالية ألكساندرز" loading="lazy" decoding="async">
        </div>
        <div class="card-body">
          <span class="card-tag">فعالية</span>
          <h3>عنوان الفعالية أو المبادرة</h3>
          <p>وصف مختصر لأبرز ما حدث في هذه الفعالية وأثرها المجتمعي.</p>
        </div>
      </div>
    `,
  });

  bm.add("alex-committee-card", {
    label: "بطاقة لجنة (Committee)",
    category: "أقسام ألكساندرز",
    content: `
      <div class="committee-card">
        <div class="card-header">
          <span class="card-number">01</span>
          <div class="card-icon">✦</div>
        </div>
        <h3>اسم اللجنة</h3>
        <p>وصف دور اللجنة ومهامها الأساسية داخل مجتمع ألكساندرز.</p>
      </div>
    `,
  });

  bm.add("alex-offer-card", {
    label: "بطاقة خدمة (Offer)",
    category: "أقسام ألكساندرز",
    content: `
      <div class="offer-card">
        <div class="offer-icon">🎓</div>
        <h3>عنوان الخدمة أو النشاط</h3>
        <p>شرح سريع لما نقدمه للطلاب مجاناً في هذا المسار.</p>
      </div>
    `,
  });

  bm.add("alex-cta-section", {
    label: "بانر دعوة للانضمام (CTA)",
    category: "أقسام ألكساندرز",
    content: `
      <section class="cta-section">
        <div class="container">
          <div class="cta-box fade-in visible">
            <h2>يلا انضم لـ العيلة</h2>
            <p>لو بتحب التطوع والفعاليات والتجارب الجامدة — مكانك هنا!</p>
            <a href="join.html" class="btn btn-cta">انضم إلينا الآن ←</a>
          </div>
        </div>
      </section>
    `,
  });
}

function initGrapesEditor() {
  editor = window.grapesjs.init({
    container: "#gjs",
    height: "100%",
    width: "auto",
    storageManager: false,
    fromElement: false,
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
            editor.AssetManager.add({ src: dataUrl, name: targetPath });
            updatePendingBadge();
          };
          reader.readAsDataURL(file);
        });
      },
    },
  });

  // Enforce RTL & dark theme inside GrapesJS iframe document
  editor.on("load", () => {
    const iframeDoc = editor.Canvas.getDocument();
    if (iframeDoc?.documentElement) {
      iframeDoc.documentElement.setAttribute("lang", "ar");
      iframeDoc.documentElement.setAttribute("dir", "rtl");
      iframeDoc.documentElement.setAttribute("data-theme", "dark");
    }
    applyVariablesToCanvas();
  });

  // Track edits to current page automatically
  const markCurrentPageDirty = () => {
    const existing = pageDrafts.get(currentPageFile) || {
      title: `Alexanders | ${currentPageFile}`,
      extraCss: PAGE_EXTRA_CSS[currentPageFile] || [],
      isNew: false,
    };
    existing.bodyHtml = normalizeExportedHtml(editor.getHtml());
    existing.scopedCss = editor.getCss({ avoidProtected: true }) || "";
    existing.dirty = true;
    pageDrafts.set(currentPageFile, existing);
    updatePendingBadge();
  };

  editor.on("component:update", markCurrentPageDirty);
  editor.on("style:property:update", markCurrentPageDirty);

  registerDesignSystemBlocks(editor);
}

// ============================================================================
// 4. Page Loading, Custom Page Creation & Visual Link Picker
// ============================================================================
async function loadPageIntoCanvas(filename) {
  currentPageFile = filename;
  el.pageSelector.value = filename;

  if (pageDrafts.has(filename)) {
    const draft = pageDrafts.get(filename);
    const previewHtml = draft.bodyHtml.replace(/(src|srcset)="assets\//g, '$1="../assets/');
    editor.setComponents(previewHtml);
    editor.setStyle(draft.scopedCss || "");
    applyVariablesToCanvas();
    return;
  }

  try {
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
      isNew: false,
    });

    editor.setComponents(bodyHtml);
    editor.setStyle(scopedCss);
    applyVariablesToCanvas();
  } catch (err) {
    alert(`تعذر تحميل الصفحة ${filename}: ${err.message}`);
  }
}

function createCustomPage() {
  const title = el.newPageTitle.value.trim();
  const rawSlug = el.newPageSlug.value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!title || !rawSlug) {
    alert("يرجى إدخال عنوان الصفحة واسم ملف (slug) صحيح بالإنجليزية.");
    return;
  }

  const filename = `${rawSlug}.html`;
  const starterBody = `
  <section class="page-hero">
    <div class="container">
      <div class="fade-in visible">
        <span class="section-label">صفحة جديدة</span>
        <h1>${escapeHtml(title)}</h1>
        <p>ابدأ بسحب وإفلات الأقسام من القائمة الجانبية لبناء محتوى هذه الصفحة.</p>
      </div>
    </div>
  </section>`;

  pageDrafts.set(filename, {
    title: `Alexanders | ${title}`,
    extraCss: [],
    bodyHtml: starterBody,
    scopedCss: "",
    dirty: true,
    isNew: true,
  });

  // Add to page selector if not already present
  if (!Array.from(el.pageSelector.options).some((o) => o.value === filename)) {
    const opt = document.createElement("option");
    opt.value = filename;
    opt.textContent = `${title} (${filename})`;
    el.pageSelector.appendChild(opt);
  }

  el.newPageModal.hidden = true;
  el.newPageTitle.value = "";
  el.newPageSlug.value = "";

  loadPageIntoCanvas(filename);
  updatePendingBadge();
}

function openLinkPicker() {
  const selected = editor?.getSelected();
  if (!selected) {
    alert("يرجى الضغط على رابط أو زر داخل الصفحة أولاً لاختيار وجهته.");
    return;
  }

  // Populate page dropdown with all existing + newly created custom pages
  el.linkPageSelect.innerHTML = "";
  Array.from(el.pageSelector.options).forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.textContent;
    el.linkPageSelect.appendChild(o);
  });

  el.linkPickerModal.hidden = false;
}

function applySelectedLink() {
  const selected = editor?.getSelected();
  if (!selected) return;

  const mode = el.linkTargetType.value;
  let href = "";
  if (mode === "page") href = el.linkPageSelect.value;
  else if (mode === "anchor") href = el.linkAnchorSelect.value;
  else href = el.linkExternalInput.value.trim();

  if (!href) {
    alert("يرجى إدخال أو اختيار رابط صحيح.");
    return;
  }

  // Apply href to selected element or its closest <a> ancestor
  const targetComp =
    selected.get("tagName") === "a" ? selected : selected.closestType?.("link") || selected;
  targetComp.addAttributes({
    href,
    ...(mode === "external" ? { target: "_blank", rel: "noopener noreferrer" } : {}),
  });

  el.linkPickerModal.hidden = true;
}

// ============================================================================
// 5. css/variables.css Theme & Typography Live Editor
// ============================================================================
async function loadVariablesCss() {
  try {
    const res = await fetch("../css/variables.css", { cache: "no-cache" });
    if (!res.ok) return;
    variablesCssText = await res.text();
    syncThemeInputsFromCss(variablesCssText);
  } catch {
    // ignore
  }
}

function syncThemeInputsFromCss(cssText) {
  const rootMatch = cssText.match(/:root\s*\{([\s\S]*?)\}/);
  const lightMatch = cssText.match(/\[data-theme="light"\]\s*\{([\s\S]*?)\}/);
  const rootBlock = rootMatch ? rootMatch[1] : "";
  const lightBlock = lightMatch ? lightMatch[1] : "";

  document.querySelectorAll('input[type="color"][data-token]').forEach((input) => {
    const scopeBlock = input.dataset.themeScope === "light" ? lightBlock : rootBlock;
    const token = input.dataset.token;
    const re = new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})`);
    const m = scopeBlock.match(re);
    if (m) input.value = m[1];
  });
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
  if (!iframeDoc || !variablesCssText) return;
  let styleTag = iframeDoc.getElementById("studioLiveVariables");
  if (!styleTag) {
    styleTag = iframeDoc.createElement("style");
    styleTag.id = "studioLiveVariables";
    iframeDoc.head.appendChild(styleTag);
  }
  styleTag.textContent = variablesCssText;
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
    el.prFileList.textContent = "لا توجد تعديلات معلقة حالياً. قم بتعديل صفحة أو لون أو رفع صورة أولاً.";
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

    // Clear dirty flags after successful PR submission
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

  el.newPageBtn.addEventListener("click", () => {
    el.newPageModal.hidden = false;
  });
  el.cancelNewPageBtn.addEventListener("click", () => {
    el.newPageModal.hidden = true;
  });
  el.confirmNewPageBtn.addEventListener("click", createCustomPage);

  el.linkPickerBtn.addEventListener("click", openLinkPicker);
  el.cancelLinkPickerBtn.addEventListener("click", () => {
    el.linkPickerModal.hidden = true;
  });
  el.linkTargetType.addEventListener("change", () => {
    const mode = el.linkTargetType.value;
    el.linkPageGroup.hidden = mode !== "page";
    el.linkAnchorGroup.hidden = mode !== "anchor";
    el.linkExternalGroup.hidden = mode !== "external";
  });
  el.applyLinkBtn.addEventListener("click", applySelectedLink);

  el.themePanelBtn.addEventListener("click", () => {
    el.themeDrawer.hidden = !el.themeDrawer.hidden;
  });
  el.closeThemeDrawerBtn.addEventListener("click", () => {
    el.themeDrawer.hidden = true;
  });

  document.querySelectorAll('input[type="color"][data-token]').forEach((input) => {
    input.addEventListener("input", () => {
      updateCssToken(input.dataset.themeScope, input.dataset.token, input.value);
    });
  });

  el.tokenFontPrimary.addEventListener("change", () => {
    updateCssToken("dark", "--font-primary", el.tokenFontPrimary.value);
  });
  el.tokenFontDisplay.addEventListener("change", () => {
    updateCssToken("dark", "--font-display", el.tokenFontDisplay.value);
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
