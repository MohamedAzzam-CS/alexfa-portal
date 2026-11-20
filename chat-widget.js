// ==============================================================================
// Alexanders Group - Cloudflare Worker + Puter.js Hybrid AI Chat Widget
// - Strict Prompt Isolation: System prompt & Knowledge Base live ONLY in Worker.
// - 21-FAQ Short-Circuit Fast Path: Clicking an FAQ sends { faqId: 1..21, sessionId }
//   with zero guest quota impact, while always logging the interaction on the server.
// - Typed Input Separation: Manually typed messages ALWAYS send { message, history, sessionId }
//   through the normal 5-message guest quota check and AI inference pipeline.
// ==============================================================================
(function () {
  "use strict";

  const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
  const API_BASE =
    typeof window !== "undefined" && typeof window.ALEXANDERS_CHAT_API_BASE === "string"
      ? window.ALEXANDERS_CHAT_API_BASE
      : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
        ? ""
        : DEFAULT_WORKER_ORIGIN;

  const CHAT_ENDPOINT = `${API_BASE}/api/chat`;
  const FAQS_ENDPOINT = `${API_BASE}/api/faqs`;
  const QUOTA_ENDPOINT = `${API_BASE}/api/quota`;
  const LINK_ENDPOINT = `${API_BASE}/api/auth/link`;

  const GUEST_LIMIT = 5;
  const MAX_HISTORY_MESSAGES = 12; // Keep last 6 conversation turns
  const SESSION_STORAGE_KEY = "alex_chat_session_id";
  const FAQ_CACHE_STORAGE_KEY = "alex_chat_faqs_cache_v1";
  const FAQ_CATALOG_VERSION = "2026-v1";

  const FB_URL = "https://www.facebook.com/share/1HKtdgUo2Y/";

  // Initial 21 FAQ items (id: 1..21) for instant chip rendering before/while GET /api/faqs syncs
  const DEFAULT_FAQ_ITEMS = [
    { id: 1, faqRef: "faq-1", question: "إيه هو كيان ألكساندرز؟" },
    { id: 2, faqRef: "faq-2", question: "إيه هي لجان ألكسندرز؟" },
    { id: 3, faqRef: "faq-3", question: "مين يقدر ينضم للكيان؟" },
    { id: 4, faqRef: "faq-4", question: "إزاي أقدم؟" },
    { id: 5, faqRef: "faq-5", question: "إيه الفرق بين Member و General Member؟" },
    { id: 6, faqRef: "faq-6", question: "إيه الفرق بين الأعضاء والبورد؟" },
    { id: 7, faqRef: "faq-7", question: "هل الأنشطة والكورسات مجانية؟" },
    { id: 8, faqRef: "faq-8", question: "هل الانضمام بيأثر على الدراسة؟" },
    { id: 9, faqRef: "faq-9", question: "إيه دور لجنة التنظيم OC؟" },
    { id: 10, faqRef: "faq-10", question: "إيه دور لجنة الـ HR؟" },
    { id: 11, faqRef: "faq-11", question: "إيه دور لجنة العلاقات العامة PR؟" },
    { id: 12, faqRef: "faq-12", question: "إيه دور لجنة الميديا Media؟" },
    { id: 13, faqRef: "faq-13", question: "إيه دور اللجنة الفنية والهاند ميد؟" },
    { id: 14, faqRef: "faq-14", question: "إيه دور لجنة البرمجة Programming؟" },
    { id: 15, faqRef: "faq-15", question: "إيه نظام الـ HR Follower والإنذارات؟" },
    { id: 16, faqRef: "faq-16", question: "إيه أبرز إيفنتات وإنجازات الكيان؟" },
    { id: 17, faqRef: "faq-17", question: "مين شركاء كيان ألكساندرز؟" },
    { id: 18, faqRef: "faq-18", question: "الكيان تابع لمين ومكانه فين؟" },
    { id: 19, faqRef: "faq-19", question: "إمتى ميعاد التقديم؟" },
    { id: 20, faqRef: "faq-20", question: "إزاي أقدم على البورد؟" },
    { id: 21, faqRef: "faq-21", question: "إيه صفحات التواصل الرسمية؟" },
  ];

  const WELCOME_MESSAGE =
    "أهلاً بك في مجتمع **ألكساندرز (Alexanders Group)** بجامعة الإسكندرية! 👋\n" +
    "الأسئلة الشائعة (FAQ) مجانية دائماً بلا حدود، ولديك **5 رسائل مجانية** للأسئلة المكتوبة كزائر قبل تسجيل الدخول عبر Puter.\n" +
    "FAQ quick chips are always free; you also have **5 free guest messages** for custom typed questions before signing in with Puter.";

  // Runtime state
  let sessionId = getOrCreateSessionId();
  let faqCatalog = loadCachedFaqs() || DEFAULT_FAQ_ITEMS;
  let conversationHistory = [];
  let pendingMessage = null;
  let isBusy = false;
  let sessionNonce = 0;
  let guestQuota = {
    count: 0,
    limit: GUEST_LIMIT,
    remaining: GUEST_LIMIT,
  };
  let currentUserProfile = null;

  // DOM references set on mount
  const dom = {};

  // ============================================================================
  // 1. Session ID, FAQ Local Cache & Puter.js Authentication Helpers
  // ============================================================================
  function generateAnonSessionId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `anon_${crypto.randomUUID().replace(/-/g, "")}`;
    }
    return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  }

  function getOrCreateSessionId() {
    try {
      const existing = localStorage.getItem(SESSION_STORAGE_KEY);
      if (existing && /^anon_[a-zA-Z0-9_-]{10,60}$/.test(existing)) {
        return existing;
      }
      const created = generateAnonSessionId();
      localStorage.setItem(SESSION_STORAGE_KEY, created);
      return created;
    } catch {
      return generateAnonSessionId();
    }
  }

  function persistSessionId(newSid) {
    if (!newSid || typeof newSid !== "string") return;
    sessionId = newSid;
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, newSid);
    } catch {
      // Ignore storage quota errors in private browsing
    }
  }

  function loadCachedFaqs() {
    try {
      const raw = localStorage.getItem(FAQ_CACHE_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.version === FAQ_CATALOG_VERSION &&
        Array.isArray(parsed.faqs) &&
        parsed.faqs.length === 21
      ) {
        return parsed.faqs;
      }
    } catch {
      // Ignore corrupted local cache
    }
    return null;
  }

  function saveCachedFaqs(version, faqs) {
    try {
      localStorage.setItem(
        FAQ_CACHE_STORAGE_KEY,
        JSON.stringify({
          version: version || FAQ_CATALOG_VERSION,
          cachedAt: Date.now(),
          faqs,
        })
      );
    } catch {
      // Ignore storage write errors
    }
  }

  async function syncFaqsFromWorker() {
    const cached = loadCachedFaqs();
    if (cached && cached.every((item) => item.answer)) {
      faqCatalog = cached;
      renderFaqChips();
      return;
    }

    try {
      const res = await fetch(FAQS_ENDPOINT, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.faqs) && data.faqs.length > 0) {
        faqCatalog = data.faqs;
        saveCachedFaqs(data.version || FAQ_CATALOG_VERSION, data.faqs);
        renderFaqChips();
      }
    } catch {
      // Fallback to DEFAULT_FAQ_ITEMS on network error
    }
  }

  function isPuterAvailable() {
    return Boolean(typeof window !== "undefined" && window.puter && window.puter.auth);
  }

  function isUserSignedIn() {
    try {
      return Boolean(
        isPuterAvailable() &&
          typeof window.puter.auth.isSignedIn === "function" &&
          window.puter.auth.isSignedIn()
      );
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the active Puter auth token from Puter.js SDK or storage.
   */
  async function getPuterAuthToken() {
    if (!isUserSignedIn()) return null;

    try {
      if (typeof window.puter.auth.getAuthToken === "function") {
        const token = await window.puter.auth.getAuthToken();
        if (token && typeof token === "string") return token;
      }
    } catch {
      // Fallback to direct properties
    }

    if (typeof window.puter?.authToken === "string" && window.puter.authToken) {
      return window.puter.authToken;
    }
    if (typeof window.puter?.auth?.token === "string" && window.puter.auth.token) {
      return window.puter.auth.token;
    }

    try {
      const storedToken =
        localStorage.getItem("puter.auth.token") ||
        localStorage.getItem("auth_token");
      if (storedToken) return storedToken;
    } catch {
      // Ignore storage access errors
    }

    return null;
  }

  /**
   * Fetches the authenticated user's profile { userId, email, username } via Puter.js.
   */
  async function fetchPuterUserProfile() {
    if (!isUserSignedIn()) {
      currentUserProfile = null;
      return null;
    }
    try {
      if (typeof window.puter.auth.getUser === "function") {
        const user = await window.puter.auth.getUser();
        if (user && !user.is_temp) {
          currentUserProfile = {
            userId: user.uuid || user.id || null,
            username: user.username || null,
            email: user.email || null,
          };
          return currentUserProfile;
        }
      }
    } catch {
      // Ignore lookup failures
    }
    return currentUserProfile;
  }

  /**
   * Links the pre-login guest sessionId with the newly authenticated Puter user
   * on the Cloudflare Worker so the initial 5 guest messages are associated with their account.
   */
  async function linkSessionWithWorker() {
    const token = await getPuterAuthToken();
    if (!token) return;
    const profile = (await fetchPuterUserProfile()) || {};

    try {
      const res = await fetch(LINK_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          userId: profile.userId || null,
          email: profile.email || null,
          username: profile.username || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.sessionId) persistSessionId(data.sessionId);
      }
    } catch (err) {
      console.warn("[Alexanders Chat] Session link warning:", err?.message || err);
    }
  }

  /**
   * Syncs initial guest quota and sessionId with the Cloudflare Worker.
   */
  async function syncQuotaFromWorker() {
    try {
      const token = await getPuterAuthToken();
      const headers = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const url = `${QUOTA_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`;
      const res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers,
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.sessionId) {
        persistSessionId(data.sessionId);
      }
      if (data?.guestQuota) {
        guestQuota = {
          count: Number(data.guestQuota.count || 0),
          limit: Number(data.guestQuota.limit || GUEST_LIMIT),
          remaining: Number(
            data.guestQuota.remaining ?? Math.max(0, GUEST_LIMIT - (data.guestQuota.count || 0))
          ),
        };
      }
      refreshAuthUI();
    } catch {
      // Non-fatal if offline during initial mount
    }
  }

  async function refreshAuthUI() {
    if (!dom.statusText || !dom.authPill) return;

    if (isUserSignedIn()) {
      const profile = await fetchPuterUserProfile();
      if (profile && profile.username) {
        dom.statusText.textContent = `متصل • ${profile.username} (غير محدود)`;
        dom.authPill.hidden = true;
        return;
      }
      if (profile && profile.userId) {
        dom.statusText.textContent = "متصل (رسائل غير محدودة)";
        dom.authPill.hidden = true;
        return;
      }
    }

    const rem = Math.max(0, guestQuota.remaining);
    dom.statusText.textContent =
      rem > 0
        ? `وضع الضيف • متبقي ${rem} من ${guestQuota.limit} رسائل`
        : "انتهت الرسائل المجانية (0/5) • سجّل الدخول";
    dom.authPill.textContent = "تسجيل الدخول";
    dom.authPill.title = "تسجيل الدخول بحساب Puter لرسائل غير محدودة";
    dom.authPill.hidden = false;
  }

  function showAuthPrompt(errorText) {
    if (!dom.authCard) return;
    dom.authCard.hidden = false;
    if (dom.authError) {
      if (errorText) {
        dom.authError.textContent = errorText;
        dom.authError.hidden = false;
      } else {
        dom.authError.textContent = "";
        dom.authError.hidden = true;
      }
    }
    scrollToBottom();
  }

  function hideAuthPrompt() {
    if (!dom.authCard) return;
    dom.authCard.hidden = true;
    if (dom.authError) {
      dom.authError.textContent = "";
      dom.authError.hidden = true;
    }
  }

  function triggerPuterSignIn() {
    if (!isPuterAvailable()) {
      showAuthPrompt("تعذر تحميل خدمة Puter.js. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.");
      return;
    }

    const authNonce = sessionNonce;
    if (dom.signInBtn) dom.signInBtn.disabled = true;
    if (dom.authError) dom.authError.hidden = true;
    if (dom.statusText) {
      dom.statusText.textContent = "جاري تسجيل الدخول عبر Puter...";
    }

    let signInPromise;
    try {
      signInPromise = window.puter.auth.signIn();
    } catch {
      if (dom.signInBtn) dom.signInBtn.disabled = false;
      refreshAuthUI();
      showAuthPrompt(
        "المتصفح منع نافذة تسجيل الدخول (Popup blocked). اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى."
      );
      return;
    }

    Promise.resolve(signInPromise)
      .then(async () => {
        if (dom.signInBtn) dom.signInBtn.disabled = false;
        const token = await getPuterAuthToken();
        if (!isUserSignedIn() || !token) {
          refreshAuthUI();
          showAuthPrompt("لم يكتمل تسجيل الدخول. اضغط على الزر للمحاولة مرة أخرى.");
          return;
        }

        hideAuthPrompt();
        await linkSessionWithWorker();
        await refreshAuthUI();

        if (authNonce === sessionNonce && pendingMessage) {
          const nextMsg = pendingMessage;
          pendingMessage = null;
          sendMessage(nextMsg);
        }
      })
      .catch((err) => {
        if (dom.signInBtn) dom.signInBtn.disabled = false;
        refreshAuthUI();
        const rawMsg = String(err?.message || err || "").toLowerCase();
        const friendly = rawMsg.includes("popup")
          ? "تم حظر نافذة تسجيل الدخول. من فضلك اسمح بالنوافذ المنبثقة (Popups) وحاول مجدداً."
          : "لم يكتمل تسجيل الدخول. اضغط مرة أخرى للمتابعة بحساب Puter مجاناً.";
        showAuthPrompt(friendly);
      });
  }

  // ============================================================================
  // 2. Auto RTL/LTR Detection & Safe Markdown Renderer
  // ============================================================================
  function detectDirection(text) {
    if (!text) return "rtl";
    const stripped = text.replace(/https?:\/\/\S+/g, " ");
    const arabicChars = stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || [];
    const latinChars = stripped.match(/[A-Za-z]/g) || [];

    const firstStrong = stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FFA-Za-z]/);
    if (firstStrong) {
      return /[A-Za-z]/.test(firstStrong[0]) && latinChars.length >= arabicChars.length
        ? "ltr"
        : /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(firstStrong[0])
          ? "rtl"
          : latinChars.length > arabicChars.length
            ? "ltr"
            : "rtl";
    }
    return "rtl";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getFriendlyLinkLabel(escapedUrl) {
    const raw = String(escapedUrl || "").replace(/&amp;/gi, "&").trim();
    const lower = raw.toLowerCase();

    if (lower.includes("1faipqlsfkn_czjz68t4tmcxltahpzud65tlbo3nponrsan1msrre3xa")) {
      return "member_application_form";
    }
    if (lower.includes("1faipqlscy4iyrtpvghlack38xee72-eyg6bya17iwbbsurnm_xrsfma")) {
      return "board_application_form";
    }
    if (lower.includes("vt.tiktok.com/zsbps")) {
      return "our_intro_video";
    }
    if (lower.includes("facebook.com") || lower.includes("fb.com")) {
      return "our_facebook";
    }
    if (lower.includes("instagram.com")) {
      return "our_instagram";
    }
    if (lower.includes("linkedin.com")) {
      return "our_linkedin";
    }
    if (lower.includes("tiktok.com")) {
      return "our_tiktok";
    }
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
      return "our_youtube";
    }
    if (lower.includes("docs.google.com/forms")) {
      return "application_form";
    }

    try {
      const parsed = new URL(raw);
      return parsed.hostname.replace(/^www\./, "");
    } catch {
      return escapedUrl;
    }
  }

  function applyInlineMarkdown(escapedLine) {
    let line = escapedLine.replace(/[\uE000\uE001]/g, "");
    const linkPlaceholders = [];

    line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      const idx = linkPlaceholders.length;
      const trimmedLabel = label.trim();
      const displayLabel = /^https?:\/\//i.test(trimmedLabel)
        ? getFriendlyLinkLabel(url)
        : label;
      linkPlaceholders.push(
        `<a href="${url}" target="_blank" rel="noopener noreferrer" dir="auto">${displayLabel}</a>`
      );
      return `\uE000L${idx}\uE001`;
    });

    line = line.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
      let cleanUrl = match;
      let trailing = "";

      while (cleanUrl.length > 0) {
        if (cleanUrl.endsWith("&quot;")) {
          cleanUrl = cleanUrl.slice(0, -6);
          trailing = "&quot;" + trailing;
        } else if (cleanUrl.endsWith("&#39;")) {
          cleanUrl = cleanUrl.slice(0, -5);
          trailing = "&#39;" + trailing;
        } else if (/[.,)\]،؛!?؟:]$/.test(cleanUrl)) {
          trailing = cleanUrl.slice(-1) + trailing;
          cleanUrl = cleanUrl.slice(0, -1);
        } else {
          break;
        }
      }

      if (!/^https?:\/\//i.test(cleanUrl)) return match;
      const idx = linkPlaceholders.length;
      const label = getFriendlyLinkLabel(cleanUrl);
      linkPlaceholders.push(
        `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" dir="auto">${label}</a>`
      );
      return `\uE000L${idx}\uE001${trailing}`;
    });

    line = line.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    line = line.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    line = line.replace(/\uE000L(\d+)\uE001/g, (_, idx) => linkPlaceholders[Number(idx)] || "");
    return line;
  }

  function renderMarkdown(rawText) {
    const escaped = escapeHtml(String(rawText || "").replace(/\r\n/g, "\n"));
    const lines = escaped.split("\n");
    const htmlBlocks = [];
    let listType = null;
    let listItems = [];
    let paraLines = [];

    const flushList = () => {
      if (!listType || listItems.length === 0) return;
      htmlBlocks.push(`<${listType}>${listItems.join("")}</${listType}>`);
      listType = null;
      listItems = [];
    };

    const flushParagraph = () => {
      if (paraLines.length === 0) return;
      htmlBlocks.push(`<p>${paraLines.join("<br>")}</p>`);
      paraLines = [];
    };

    for (const rawLine of lines) {
      const trimmed = rawLine.trim();

      if (!trimmed) {
        flushList();
        flushParagraph();
        continue;
      }

      const ulMatch = trimmed.match(/^(?:[-*•])\s+(.+)$/);
      if (ulMatch) {
        flushParagraph();
        if (listType && listType !== "ul") flushList();
        listType = "ul";
        listItems.push(`<li>${applyInlineMarkdown(ulMatch[1])}</li>`);
        continue;
      }

      const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);
      if (olMatch) {
        flushParagraph();
        if (listType && listType !== "ol") flushList();
        listType = "ol";
        listItems.push(`<li>${applyInlineMarkdown(olMatch[1])}</li>`);
        continue;
      }

      flushList();
      const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
      const content = headingMatch ? `**${headingMatch[1].replace(/\*\*/g, "")}**` : trimmed;
      paraLines.push(applyInlineMarkdown(content));
    }

    flushList();
    flushParagraph();

    return htmlBlocks.join("") || `<p></p>`;
  }

  // ============================================================================
  // 3. Message DOM & FAQ Quick-Select Bar Controls
  // ============================================================================
  function scrollToBottom() {
    if (dom.messages) {
      dom.messages.scrollTop = dom.messages.scrollHeight;
    }
  }

  function appendMessage(role, rawText, options = {}) {
    if (!dom.messages) return null;

    const msgEl = document.createElement("div");
    msgEl.className = `alex-chat-msg alex-chat-msg--${role}`;
    if (options.isError) {
      msgEl.classList.add("alex-chat-msg--error");
    }

    const dir = detectDirection(rawText);
    msgEl.setAttribute("dir", dir);

    const bodyEl = document.createElement("div");
    bodyEl.className = "alex-chat-msg-body";
    bodyEl.setAttribute("dir", dir);

    if (options.isTyping) {
      bodyEl.innerHTML =
        '<div class="alex-chat-typing" aria-label="جاري الكتابة">' +
        '<span class="alex-chat-dot"></span>' +
        '<span class="alex-chat-dot"></span>' +
        '<span class="alex-chat-dot"></span>' +
        "</div>";
    } else {
      bodyEl.innerHTML = renderMarkdown(rawText);
    }

    msgEl.appendChild(bodyEl);
    dom.messages.appendChild(msgEl);
    scrollToBottom();

    return { msgEl, bodyEl };
  }

  function setBusy(busy) {
    isBusy = busy;
    if (dom.input) dom.input.disabled = busy;
    if (dom.sendBtn) dom.sendBtn.disabled = busy;
    if (dom.chips) {
      dom.chips.querySelectorAll(".alex-chat-chip").forEach((chip) => {
        chip.disabled = busy;
      });
    }
  }

  function setFaqCollapsed(collapsed) {
    if (!dom.faqBox || !dom.faqToggle || !dom.chips) return;
    const isCollapsed = Boolean(collapsed);
    dom.faqBox.classList.toggle("alex-chat-faq-collapsed", isCollapsed);
    dom.chips.hidden = isCollapsed;
    dom.faqToggle.setAttribute("aria-expanded", String(!isCollapsed));
  }

  function renderFaqChips() {
    if (!dom.chips) return;
    dom.chips.innerHTML = "";
    faqCatalog.forEach((faqItem) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "alex-chat-chip";
      chip.dataset.faqId = String(faqItem.id);
      chip.dataset.faqRef = faqItem.faqRef || `faq-${faqItem.id}`;
      chip.textContent = faqItem.question;
      chip.disabled = isBusy;
      chip.addEventListener("click", () => {
        if (isBusy) return;
        dispatchFaqClick(faqItem.id);
      });
      dom.chips.appendChild(chip);
    });
  }

  function resetChat() {
    sessionNonce++;
    conversationHistory = [];
    pendingMessage = null;
    hideAuthPrompt();
    setFaqCollapsed(false);
    setBusy(false);

    if (dom.messages) {
      dom.messages.innerHTML = "";
      appendMessage("assistant", WELCOME_MESSAGE);
    }
    if (dom.input) dom.input.focus();
  }

  // ============================================================================
  // 4A. Numeric FAQ Short-Circuit Dispatch ({ faqId: 1..21, sessionId })
  // Always pings POST /api/chat for weekly logging, with zero guest quota impact.
  // ============================================================================
  async function dispatchFaqClick(faqId) {
    const numericId = Number(faqId);
    if (!Number.isInteger(numericId) || numericId < 1 || numericId > 21 || isBusy) {
      return;
    }

    const cachedItem = faqCatalog.find((f) => f.id === numericId);
    const questionText = cachedItem?.question || `سؤال #${numericId}`;

    hideAuthPrompt();
    setFaqCollapsed(true);
    const activeNonce = sessionNonce;

    // Render user question bubble immediately
    appendMessage("user", questionText);
    setBusy(true);

    // If cached answer exists locally, render immediately while still pinging server to log
    const hasCachedAnswer = Boolean(cachedItem?.answer);
    const assistantNode = hasCachedAnswer
      ? appendMessage("assistant", cachedItem.answer)
      : appendMessage("assistant", "", { isTyping: true });

    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const puterToken = await getPuterAuthToken();
      if (puterToken) {
        headers.Authorization = `Bearer ${puterToken}`;
      }

      // Send ONLY { faqId, sessionId } — never free-text { message }
      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          faqId: numericId,
          sessionId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (activeNonce !== sessionNonce) return;

      if (data?.sessionId) {
        persistSessionId(data.sessionId);
      }
      if (data?.guestQuota) {
        guestQuota = {
          count: Number(data.guestQuota.count ?? guestQuota.count),
          limit: Number(data.guestQuota.limit ?? GUEST_LIMIT),
          remaining: Number(data.guestQuota.remaining ?? guestQuota.remaining),
        };
      }

      const finalAnswer = String(data?.answer || data?.reply || cachedItem?.answer || "").trim();
      if (!finalAnswer) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }

      if (!hasCachedAnswer && assistantNode) {
        const finalDir = detectDirection(finalAnswer);
        assistantNode.msgEl.setAttribute("dir", finalDir);
        assistantNode.bodyEl.setAttribute("dir", finalDir);
        assistantNode.bodyEl.innerHTML = renderMarkdown(finalAnswer);
      }

      conversationHistory.push({ role: "user", content: questionText });
      conversationHistory.push({ role: "assistant", content: finalAnswer });
      if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
      }

      await refreshAuthUI();
    } catch (err) {
      if (activeNonce !== sessionNonce) return;
      if (!hasCachedAnswer && assistantNode) {
        const msg = `حدث خطأ أثناء تحميل الإجابة. يمكنك التواصل معنا عبر [our_facebook](${FB_URL})`;
        assistantNode.msgEl.classList.add("alex-chat-msg--error");
        const errDir = detectDirection(msg);
        assistantNode.msgEl.setAttribute("dir", errDir);
        assistantNode.bodyEl.setAttribute("dir", errDir);
        assistantNode.bodyEl.innerHTML = renderMarkdown(msg);
      }
    } finally {
      if (activeNonce === sessionNonce) {
        setBusy(false);
        if (dom.input) dom.input.focus();
        scrollToBottom();
      }
    }
  }

  // ============================================================================
  // 4B. Free-Text AI Pipeline ({ message, history, sessionId })
  // Strictly used for manually typed messages (even if identical to an FAQ).
  // ============================================================================
  async function sendMessage(rawText) {
    const userText = (rawText || "").trim();
    if (!userText || isBusy) return;

    hideAuthPrompt();
    setFaqCollapsed(true);
    const activeNonce = sessionNonce;

    appendMessage("user", userText);
    if (dom.input) dom.input.value = "";
    setBusy(true);

    const assistantNode = appendMessage("assistant", "", { isTyping: true });

    try {
      const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      const puterToken = await getPuterAuthToken();
      if (puterToken) {
        headers.Authorization = `Bearer ${puterToken}`;
      }

      // Strictly send { message, history, sessionId } (never faqId) for typed input
      const payload = {
        message: userText,
        history: conversationHistory.slice(-MAX_HISTORY_MESSAGES),
        sessionId,
      };

      const response = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (activeNonce !== sessionNonce) return;

      if (data?.sessionId) {
        persistSessionId(data.sessionId);
      }
      if (data?.guestQuota) {
        guestQuota = {
          count: Number(data.guestQuota.count ?? guestQuota.count),
          limit: Number(data.guestQuota.limit ?? GUEST_LIMIT),
          remaining: Number(data.guestQuota.remaining ?? 0),
        };
      }

      // Handle 403 / 401 AUTH_REQUIRED (5-message guest limit reached or expired Puter token)
      if (
        (response.status === 403 || response.status === 401) &&
        data?.error === "AUTH_REQUIRED"
      ) {
        pendingMessage = userText;
        assistantNode?.msgEl.remove();
        await refreshAuthUI();
        showAuthPrompt(
          data.message ||
            "وصلت للحد الأقصى للرسائل المجانية كزائر (5 رسائل). سجّل الدخول مجاناً عبر Puter للمتابعة."
        );
        return;
      }

      if (!response.ok || !data?.reply) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }

      const finalReply = String(data.reply).trim();
      const finalDir = detectDirection(finalReply);
      assistantNode.msgEl.setAttribute("dir", finalDir);
      assistantNode.bodyEl.setAttribute("dir", finalDir);
      assistantNode.bodyEl.innerHTML = renderMarkdown(finalReply);

      conversationHistory.push({ role: "user", content: userText });
      conversationHistory.push({ role: "assistant", content: finalReply });
      if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
      }

      await refreshAuthUI();
    } catch (err) {
      if (activeNonce !== sessionNonce) return;

      const msg =
        err?.message && /limit|auth|تسجيل/i.test(err.message)
          ? err.message
          : `حدث خطأ أثناء الاتصال بخادم المحادثة. تأكد من تشغيل Cloudflare Worker أو تواصل معنا عبر [our_facebook](${FB_URL})`;
      assistantNode.msgEl.classList.add("alex-chat-msg--error");
      const errDir = detectDirection(msg);
      assistantNode.msgEl.setAttribute("dir", errDir);
      assistantNode.bodyEl.setAttribute("dir", errDir);
      assistantNode.bodyEl.innerHTML = renderMarkdown(msg);
    } finally {
      if (activeNonce === sessionNonce) {
        setBusy(false);
        if (dom.input) dom.input.focus();
        scrollToBottom();
      }
    }
  }

  // ============================================================================
  // 5. DOM Mounting & Event Wiring
  // ============================================================================
  function mountChatWidget() {
    if (document.getElementById("alexChatRoot")) return;

    const inlineHost = document.getElementById("alexanders-chat");
    const isInline = Boolean(inlineHost);

    const root = document.createElement("div");
    root.id = "alexChatRoot";
    root.className = isInline
      ? "alex-chat-root alex-chat-inline"
      : "alex-chat-root alex-chat-floating";

    root.innerHTML = `
      <div id="alexChatPanel" class="alex-chat-panel" role="dialog" aria-label="Alexanders AI Assistant" aria-modal="false">
        <div class="alex-chat-header">
          <div class="alex-chat-header-info">
            <div class="alex-chat-avatar" aria-hidden="true">✦</div>
            <div class="alex-chat-title-group">
              <h3 class="alex-chat-title">مساعد ألكساندرز</h3>
              <div class="alex-chat-status">
                <span class="alex-chat-status-dot" aria-hidden="true"></span>
                <span id="alexChatStatusText">وضع الضيف • 5 رسائل مجانية</span>
              </div>
            </div>
          </div>
          <div class="alex-chat-header-actions">
            <button type="button" id="alexChatAuthPill" class="alex-chat-auth-pill" title="تسجيل الدخول بحساب Puter لرسائل غير محدودة">
              تسجيل الدخول
            </button>
            <button type="button" id="alexChatClearBtn" class="alex-chat-action-btn" title="مسح المحادثة" aria-label="مسح المحادثة">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10"></polyline>
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
              </svg>
              <span>مسح</span>
            </button>
            <button type="button" id="alexChatCloseBtn" class="alex-chat-close-btn" aria-label="إغلاق">✕</button>
          </div>
        </div>

        <div id="alexChatMessages" class="alex-chat-messages"></div>

        <div id="alexChatAuthCard" class="alex-chat-auth-card" hidden>
          <p class="alex-chat-auth-title">انتهت الرسائل المجانية (5/5) — سجّل الدخول للمتابعة</p>
          <p class="alex-chat-auth-desc">
            لقد استخدمت الـ 5 رسائل المجانية للزوار. سجّل الدخول مجاناً بحساب Puter لمتابعة المحادثة بلا حدود وحفظ جلستك.
          </p>
          <p class="alex-chat-auth-subdesc">Free guest limit of 5 messages reached. Sign in free with Puter to continue with unlimited messages.</p>
          <p id="alexChatAuthError" class="alex-chat-auth-error" hidden></p>
          <div class="alex-chat-auth-actions">
            <button type="button" id="alexChatSignInBtn" class="alex-chat-signin-btn">
              تسجيل الدخول عبر Puter
            </button>
            <button type="button" id="alexChatAuthDismiss" class="alex-chat-auth-dismiss">إلغاء</button>
          </div>
        </div>

        <div id="alexChatFaqBox" class="alex-chat-faq-box">
          <button
            type="button"
            id="alexChatFaqToggle"
            class="alex-chat-faq-toggle"
            aria-expanded="true"
            aria-controls="alexChatChips"
          >
            <span>الأسئلة الشائعة (FAQ)</span>
            <svg class="alex-chat-faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <div id="alexChatChips" class="alex-chat-chips" aria-label="أسئلة سريعة"></div>
        </div>

        <div class="alex-chat-input-bar">
          <form id="alexChatForm" class="alex-chat-form">
            <input
              type="text"
              id="alexChatInput"
              class="alex-chat-input"
              dir="auto"
              placeholder="اسأل عن ألكساندرز بالعربي أو English..."
              autocomplete="off"
            />
            <button type="submit" id="alexChatSendBtn" class="alex-chat-send-btn" aria-label="إرسال">
              <svg class="alex-chat-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </form>
        </div>
      </div>

      <button type="button" id="alexChatLauncher" class="alex-chat-launcher" aria-label="فتح مساعد ألكساندرز الذكي" aria-expanded="false">
        <span class="alex-chat-launcher-dot" aria-hidden="true"></span>
        <svg class="alex-chat-launcher-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </button>
    `;

    if (isInline) {
      inlineHost.appendChild(root);
    } else {
      document.body.appendChild(root);
    }

    dom.root = root;
    dom.panel = document.getElementById("alexChatPanel");
    dom.launcher = document.getElementById("alexChatLauncher");
    dom.closeBtn = document.getElementById("alexChatCloseBtn");
    dom.clearBtn = document.getElementById("alexChatClearBtn");
    dom.authPill = document.getElementById("alexChatAuthPill");
    dom.statusText = document.getElementById("alexChatStatusText");
    dom.messages = document.getElementById("alexChatMessages");
    dom.authCard = document.getElementById("alexChatAuthCard");
    dom.authError = document.getElementById("alexChatAuthError");
    dom.signInBtn = document.getElementById("alexChatSignInBtn");
    dom.authDismissBtn = document.getElementById("alexChatAuthDismiss");
    dom.faqBox = document.getElementById("alexChatFaqBox");
    dom.faqToggle = document.getElementById("alexChatFaqToggle");
    dom.chips = document.getElementById("alexChatChips");
    dom.form = document.getElementById("alexChatForm");
    dom.input = document.getElementById("alexChatInput");
    dom.sendBtn = document.getElementById("alexChatSendBtn");

    renderFaqChips();

    dom.chips?.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          dom.chips.scrollLeft += e.deltaY;
        }
      },
      { passive: false }
    );

    appendMessage("assistant", WELCOME_MESSAGE);

    const setOpen = (open) => {
      if (isInline) return;
      dom.root.classList.toggle("alex-chat-open", open);
      dom.launcher?.setAttribute("aria-expanded", String(open));
      if (open) {
        setTimeout(() => dom.input?.focus(), 140);
      }
    };

    dom.launcher?.addEventListener("click", () => {
      const open = !dom.root.classList.contains("alex-chat-open");
      setOpen(open);
    });

    dom.closeBtn?.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", (e) => {
      if (!isInline && e.key === "Escape" && dom.root.classList.contains("alex-chat-open")) {
        setOpen(false);
      }
    });

    dom.clearBtn?.addEventListener("click", resetChat);
    dom.faqToggle?.addEventListener("click", () => {
      const currentlyCollapsed = dom.faqBox?.classList.contains("alex-chat-faq-collapsed");
      setFaqCollapsed(!currentlyCollapsed);
    });
    dom.authPill?.addEventListener("click", () => triggerPuterSignIn());
    dom.signInBtn?.addEventListener("click", () => triggerPuterSignIn());
    dom.authDismissBtn?.addEventListener("click", () => {
      pendingMessage = null;
      hideAuthPrompt();
    });

    // Strict separation: form submission ALWAYS sends free-text { message, history, sessionId }
    dom.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = dom.input?.value?.trim();
      if (!text) return;
      sendMessage(text);
    });

    refreshAuthUI();
    syncFaqsFromWorker();
    syncQuotaFromWorker();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChatWidget);
  } else {
    mountChatWidget();
  }
})();
