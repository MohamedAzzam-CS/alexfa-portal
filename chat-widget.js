// ==============================================================================
// Alexanders Group - Zero-Backend Puter.js AI Chat Widget
// Self-contained UI & streaming AI engine with User-Pays Puter authentication.
// ==============================================================================
(function () {
  "use strict";

  const KB_URL = "./alexanders_knowledge_base.txt";
  const MODEL_CANDIDATES = [
    "google/gemini-2.5-flash",
    "deepseek/deepseek-chat",
    undefined, // Fallback to Puter.js default fast model
  ];
  const MAX_HISTORY_MESSAGES = 12; // Keep last 6 conversation turns in memory

  const FB_URL = "https://www.facebook.com/share/1HKtdgUo2Y/";
  const IG_URL = "https://www.instagram.com/alexandersgroupp?cplk=OTVoNjFucG80YWd3";
  const LINKEDIN_URL = "https://www.linkedin.com/company/alexanders-group/";
  const TIKTOK_URL = "https://www.tiktok.com/@alexanders.groupp?_t=ZS-8w0G3h8ZYue&_r=1";
  const YOUTUBE_URL = "https://youtube.com/@alexandersgroup?si=k3B7DaCmbUiI3ybJ";
  const INTRO_VIDEO_URL = "https://vt.tiktok.com/ZSbpsEYrs/";
  const MEMBER_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSfkN_CZJz68t4tMCXlTAhpzUD65tLbO3npOnrsan1MSRRe3xA/viewform";
  const BOARD_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLScY4IYRtpvghlAck38xeE72-Eyg6BYa17IwbbsurNm_XRSfmA/viewform";

  const QUICK_CHIPS = [
    "إيه هو كيان ألكساندرز؟",
    "إيه هي لجان ألكسندرز؟",
    "مين يقدر ينضم للكيان؟",
    "إزاي أقدم؟",
    "إيه الفرق بين Member و General Member؟",
    "إيه الفرق بين الأعضاء والبورد؟",
    "هل الأنشطة والكورسات مجانية؟",
    "هل الانضمام بيأثر على الدراسة؟",
    "إيه دور لجنة التنظيم OC؟",
    "إيه دور لجنة الـ HR؟",
    "إيه دور لجنة العلاقات العامة PR؟",
    "إيه دور لجنة الميديا Media؟",
    "إيه دور اللجنة الفنية والهاند ميد؟",
    "إيه دور لجنة البرمجة Programming؟",
    "إيه نظام الـ HR Follower والإنذارات؟",
    "إيه أبرز إيفنتات وإنجازات الكيان؟",
    "مين شركاء كيان ألكساندرز؟",
    "الكيان تابع لمين ومكانه فين؟",
    "إمتى ميعاد التقديم؟",
    "إزاي أقدم على البورد؟",
    "إيه صفحات التواصل الرسمية؟",
  ];

  const WELCOME_MESSAGE =
    "أهلاً بك في مجتمع **ألكساندرز (Alexanders Group)** بجامعة الإسكندرية! 👋\n" +
    "تقدر تسأل الأسئلة الشائعة فوراً بدون تسجيل دخول، وللأسئلة المفتوحة سجّل دخول مجاني بحساب Google أو Puter.\n" +
    "FAQs work immediately without sign-in; open-ended AI questions need a free Google or Puter sign-in.";

  // Runtime state
  let kbTextCache = null;
  let kbPromise = null;
  let conversationHistory = [];
  let hasTopicalHistory = false;
  let pendingMessage = null;
  let isBusy = false;
  let sessionNonce = 0;

  // DOM references set on mount
  const dom = {};

  // ============================================================================
  // 1. Puter SDK Helpers & Auth
  // ============================================================================
  function isPuterAvailable() {
    return Boolean(
      typeof window !== "undefined" &&
        window.puter &&
        window.puter.auth &&
        window.puter.ai &&
        typeof window.puter.ai.chat === "function"
    );
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

  async function refreshAuthUI() {
    if (!dom.statusText || !dom.authPill) return;

    if (!isPuterAvailable()) {
      dom.statusText.textContent = "جاري التحميل...";
      dom.authPill.hidden = true;
      return;
    }

    if (isUserSignedIn()) {
      dom.authPill.hidden = true;
      dom.statusText.textContent = "متصل (مجاني)";
      try {
        if (typeof window.puter.auth.getUser === "function") {
          const user = await window.puter.auth.getUser();
          if (!isUserSignedIn()) return;
          if (user?.is_temp === true) {
            dom.statusText.textContent = "متصل (ضيف مجاني)";
            dom.authPill.textContent = "حساب Google";
            dom.authPill.title = "ربط أو تسجيل الدخول بحساب Google / Puter";
            dom.authPill.hidden = false;
          } else if (user?.username) {
            dom.statusText.textContent = `متصل • ${user.username}`;
            dom.authPill.hidden = true;
          }
        }
      } catch {
        // Keep generic connected label if user lookup fails
      }
    } else {
      dom.statusText.textContent = "جاهز للدردشة";
      dom.authPill.textContent = "تسجيل الدخول";
      dom.authPill.title = "تسجيل الدخول بحساب Google أو Puter";
      dom.authPill.hidden = false;
    }
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
  }

  function hideAuthPrompt() {
    if (!dom.authCard) return;
    dom.authCard.hidden = true;
    if (dom.authError) {
      dom.authError.textContent = "";
      dom.authError.hidden = true;
    }
  }

  function triggerPuterSignIn(options = {}) {
    const { requestAuth = false } = options;

    if (!isPuterAvailable()) {
      showAuthPrompt("تعذر تحميل خدمة Puter.js. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.");
      return;
    }

    const authNonce = sessionNonce;
    if (dom.signInBtn) dom.signInBtn.disabled = true;
    if (dom.authError) dom.authError.hidden = true;
    if (dom.statusText && !isUserSignedIn()) {
      dom.statusText.textContent = "جاري تسجيل الدخول...";
    }

    const signInOptions = {};
    if (requestAuth) signInOptions.request_auth = true;

    // Trigger signIn() synchronously inside direct user gesture handler to avoid popup blockers
    let signInPromise;
    try {
      signInPromise = Object.keys(signInOptions).length
        ? window.puter.auth.signIn(signInOptions)
        : window.puter.auth.signIn();
    } catch (err) {
      if (dom.signInBtn) dom.signInBtn.disabled = false;
      refreshAuthUI();
      showAuthPrompt(
        "المتصفح منع نافذة تسجيل الدخول (Popup blocked). اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى."
      );
      return;
    }

    Promise.resolve(signInPromise)
      .then(() => {
        if (dom.signInBtn) dom.signInBtn.disabled = false;
        if (!isUserSignedIn()) {
          refreshAuthUI();
          showAuthPrompt("لم يكتمل تسجيل الدخول. اضغط على الزر للمحاولة مرة أخرى.");
          return;
        }
        hideAuthPrompt();
        refreshAuthUI();

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
          : "لم يكتمل تسجيل الدخول. اضغط مرة أخرى للمتابعة بحساب Google أو Puter مجاناً.";
        showAuthPrompt(friendly);
      });
  }

  // ============================================================================
  // 2. Knowledge Base & Strict Guardrail System Prompt
  // ============================================================================
  function loadKnowledgeBase() {
    if (kbTextCache) return Promise.resolve(kbTextCache);
    if (kbPromise) return kbPromise;

    kbPromise = fetch(KB_URL, { cache: "no-cache" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.text();
      })
      .then((text) => {
        const cleaned = (text || "").trim();
        if (!cleaned) {
          throw new Error("Empty knowledge base file.");
        }
        kbTextCache = cleaned;
        return kbTextCache;
      })
      .catch((err) => {
        kbPromise = null; // Allow retry if initial load failed transiently
        throw err;
      });

    return kbPromise;
  }

  function buildSystemPrompt(kbText) {
    return [
      "You are the official AI assistant for Alexanders Group (جماعة أليكساندرز / كيان Alexanders), an official student entity at Alexandria University.",
      "",
      "STRICT SYSTEM GUARDRAILS (MUST ALWAYS BE FOLLOWED):",
      "1. Single Source of Truth: Answer ONLY using facts explicitly stated in the Knowledge Base below. NEVER invent, guess, or extrapolate missing names, conditions, links, or policies.",
      "2. Zero Dates/Deadlines Rule: NEVER mention, guess, or provide ANY specific dates, timelines, schedules, or deadlines for recruitment, interviews, courses, workshops, trips, or events — even if asked directly. State clearly that schedules and dates are announced dynamically on Alexanders Group's official social media pages (and for interviews, HR contacts applicants via WhatsApp after submitting the application form).",
      "3. Language & Tone: Automatically detect and match the user's language and dialect (Egyptian Arabic if they write in Arabic, Modern Standard Arabic if formal Arabic, or English if they write in English) with a friendly, helpful, student-oriented tone. Keep answers concise, clear, and scannable using short paragraphs or bullet points when listing items.",
      "4. Application Links Rule: Share the Board Application Form ONLY when specifically asked about Board/Leadership roles. Share the Member Application Form when asked about joining as a committee member or applying.",
      `5. Out-of-Scope Escalation: If a question is not covered in the Knowledge Base, politely state that you do not have that information (matching the user's language) and direct the student to message Alexanders Group via [our_facebook](${FB_URL}) or [our_instagram](${IG_URL}) for accurate details.`,
      `6. Links Formatting: ALWAYS format every URL as a clickable Markdown link with a short descriptive title — never print raw URLs as visible text. Use these exact titles for Alexanders Group links: [our_facebook](${FB_URL}), [our_instagram](${IG_URL}), [our_linkedin](${LINKEDIN_URL}), [our_tiktok](${TIKTOK_URL}), [our_youtube](${YOUTUBE_URL}), [our_intro_video](${INTRO_VIDEO_URL}), [member_application_form](${MEMBER_FORM_URL}), and [board_application_form](${BOARD_FORM_URL}). Do not repeat the platform name immediately before the link (e.g., write "- [our_facebook](...)" rather than "- Facebook: [our_facebook](...)").`,
      "",
      "=== ALEXANDERS GROUP KNOWLEDGE BASE ===",
      kbText,
    ].join("\n");
  }

  // ============================================================================
  // 3. Auto RTL/LTR Detection & Safe Markdown Renderer
  // ============================================================================
  function detectDirection(text) {
    if (!text) return "rtl";
    const stripped = text.replace(/https?:\/\/\S+/g, " ");
    const arabicChars = stripped.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g) || [];
    const latinChars = stripped.match(/[A-Za-z]/g) || [];

    // Check first strong directional letter (ignoring URLs)
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
    // Strip PUA sentinel range if present in user text so placeholders stay unambiguous
    let line = escapedLine.replace(/[\uE000\uE001]/g, "");
    const linkPlaceholders = [];

    // 1. Protect explicit Markdown links [label](https://...)
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

    // 2. Linkify bare URLs cleanly without swallowing trailing punctuation
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

    // 3. Inline code and bold formatting
    line = line.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    line = line.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");

    // 4. Restore link placeholders
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
      // Convert Markdown headings (### Heading) cleanly into bold lines
      const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
      const content = headingMatch ? `**${headingMatch[1].replace(/\*\*/g, "")}**` : trimmed;
      paraLines.push(applyInlineMarkdown(content));
    }

    flushList();
    flushParagraph();

    return htmlBlocks.join("") || `<p></p>`;
  }

  // ============================================================================
  // 4. Message DOM & Controls
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

  function resetChat() {
    sessionNonce++;
    conversationHistory = [];
    hasTopicalHistory = false;
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
  // 5. Puter.js AI Streaming Engine
  // ============================================================================
  function extractStreamChunk(part) {
    if (typeof part === "string") return part;
    if (!part || typeof part !== "object") return "";
    return (
      part.text ??
      part.choices?.[0]?.delta?.content ??
      part.delta?.text ??
      part.message?.content ??
      ""
    );
  }

  function isAuthRelatedError(err) {
    const status = err?.status || err?.code;
    const msg = String(err?.message || err || "").toLowerCase();
    return (
      status === 401 ||
      status === 403 ||
      msg.includes("auth") ||
      msg.includes("sign in") ||
      msg.includes("unauthorized") ||
      msg.includes("token")
    );
  }

  async function streamPuterReply(messages, onToken, activeNonce) {
    let lastErr = null;

    for (const model of MODEL_CANDIDATES) {
      const options = model
        ? { model, stream: true, temperature: 0.2 }
        : { stream: true, temperature: 0.2 };

      try {
        const response = await window.puter.ai.chat(messages, options);
        let fullText = "";

        if (response && typeof response[Symbol.asyncIterator] === "function") {
          for await (const part of response) {
            if (activeNonce !== sessionNonce) return null;
            const chunk = extractStreamChunk(part);
            if (chunk) {
              fullText += chunk;
              onToken(fullText);
            }
          }
        } else {
          const single =
            typeof response === "string"
              ? response
              : response?.message?.content ??
                response?.choices?.[0]?.message?.content ??
                response?.text ??
                String(response || "");
          fullText = single;
          if (fullText) onToken(fullText);
        }

        if (fullText.trim()) {
          return fullText.trim();
        }
        lastErr = new Error("Empty model response");
      } catch (err) {
        if (activeNonce !== sessionNonce) return null;
        if (isAuthRelatedError(err)) throw err;
        lastErr = err;
        console.warn(`[Alexanders Chat] Model (${model || "default"}) failed:`, err?.message || err);
      }
    }

    throw lastErr || new Error("All AI models failed to respond.");
  }

  // ============================================================================
  // 5B. Zero-Auth Bilingual FAQ Matcher (Grounded in Knowledge Base)
  // ============================================================================
  function normalizeForFaq(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchFaqReply(rawText, options = {}) {
    const { fromFaqChip = false, allowTopicalFaq = true } = options;
    const norm = normalizeForFaq(rawText);
    if (!norm) return null;

    const isEn = detectDirection(rawText) === "ltr";

    // 1. Standalone Greetings & Thanks (allowed while signed out even after topical turns)
    if (
      /^(hi|hello|hey|yo|hola|good morning|good evening|good afternoon|اهلا|اهلا بيك|اهلا وسهلا|مرحبا|السلام عليكم|سلام عليكم|ازيك|ازيكم|عامل ايه|عاملين ايه|صباح الخير|مساء الخير|هالو|هاي|الو)$/.test(
        norm
      )
    ) {
      return {
        isGreeting: true,
        reply: isEn
          ? "Hello and welcome to **Alexanders Group** at Alexandria University! 👋 How can I help you today? You can ask me about our 6 committees, eligibility, membership types, or how to apply."
          : "أهلاً بك في كيان **ألكساندرز (Alexanders Group)**! 👋 إزاي أقدر أساعدك النهاردة؟ تقدر تسألني عن اللجان الـ 6، شروط الانضمام، الفرق بين أنواع العضوية، أو طريقة التقديم.",
      };
    }

    if (
      /^(thanks|thank you|thanks a lot|thx|ty|ok|okay|cool|great|got it|bye|goodbye|شكرا|شكرا جزيلا|متشكر|تسلم|تسلم ايدك|الف شكر|يعطيك العافيه|تمام|ماشي|اوكي|باي|سلام)$/.test(
        norm
      )
    ) {
      return {
        isGreeting: true,
        reply: isEn
          ? "You're welcome! Feel free to ask anytime if you have more questions about Alexanders Group."
          : "العفو! لو عندك أي سؤال تاني عن كيان ألكساندرز أو اللجان، أنا موجود دايماً.",
      };
    }

    if (!allowTopicalFaq) return null;
    if (!fromFaqChip && norm.length > 85) return null;

    const cleaned = norm
      .replace(
        /^(لو سمحت|من فضلك|ممكن اعرف|ممكن تقولي|ممكن اسال|عايز اعرف|عاوز اعرف|please|can you tell me|could you tell me)\s+/,
        ""
      )
      .trim();

    // 2. Zero Dates / Deadlines Rule (checked BEFORE application/committees)
    if (
      /^(امتي|امتا|متي) (التقديم|فتح التقديم|ميعاد التقديم|موعد التقديم|الانترفيو|ميعاد الانترفيو|مواعيد التقديم|مواعيد الكورسات|مواعيد الايفنتات)( في الكساندرز| في الكسندرز| في الكيان)?$/.test(
        cleaned
      ) ||
      /^(هل )?(التقديم مفتوح|التقديم فاتح|في تقديم دلوقتي|فيه تقديم دلوقتي|التقديم مفتوح دلوقتي|مواعيد التقديم ايه|ايه مواعيد التقديم|ميعاد التقديم امتي|ديدلاين التقديم امتي)$/.test(
        cleaned
      ) ||
      /^(when is|when does) (recruitment|registration|application|the interview|interviews|the next event)( open| start)?$/.test(
        cleaned
      ) ||
      /^(is (recruitment|registration|application) open( now)?|what are the (dates|deadlines)( for (recruitment|registration|applying))?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? `Schedules and dates for recruitment, interviews, courses, and events are announced dynamically on our official social media pages (not fixed in advance). Follow us for updates:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\nIf you already submitted the form, an HR team member will contact you via WhatsApp to arrange your interview.`
          : `مواعيد التقديم، الانترفيوهات، الكورسات، والفعاليات بتُعلن بشكل متجدد أول بأول على صفحاتنا الرسمية مش بمواعيد ثابتة:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\nوبالنسبة للي ملأ الفورم بالفعل، بيتواصل معاه مسؤول من الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو.`,
      };
    }

    // 3. Board Application Form ONLY when specifically asked about applying for Board
    if (
      /^(ازاي اقدم (علي |ل|في )?البورد|طريقه التقديم (علي |ل|في )?البورد|عايز اقدم (علي |ل|في )?البورد|عاوز اقدم (علي |ل|في )?البورد|فورم( تقديم)? البورد|لينك( تقديم)? البورد|رابط( تقديم)? البورد)$/.test(
        cleaned
      ) ||
      /^(how (do i |to )?apply (for|to) (the )?board|board application form|board form( link)?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? `You can apply for **The Board** here:\n[board_application_form](${BOARD_FORM_URL})\nAfter submitting the form, an HR representative will contact you via WhatsApp to schedule your interview date, time, and location.`
          : `تقدر تقدم على **البورد (Board)** من هنا:\n[board_application_form](${BOARD_FORM_URL})\nوبعد ملء الفورم، هيتواصل معاك ممثل من لجنة الـ HR على واتساب لتحديد ميعاد ومكان المقابلة.`,
      };
    }

    // 4. Committee Member vs. General Member
    if (
      /^(ايه )?(الفرق بين member و general member|الفرق بين committee member و general member|الفرق بين عضو اللجنه و(ال)?عضو العام|الفرق بين اعضاء اللجان والاعضاء العامون|الفرق بين اعضاء اللجان والعضو العام|الفرق بين العام وعضو اللجنه|انواع العضويه( في الكيان| في الكساندرز| في الكسندرز)?|ايه هي انواع العضويه( في الكيان| في الكساندرز| في الكسندرز)?)$/.test(
        cleaned
      ) ||
      /^(what is the )?(difference between (a )?(committee )?member and (a )?general member|types of membership|membership types)( in alexanders( group)?)?$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "We have **2 membership types**:\n- **Committee Members:** Join 1 of our 6 committees after passing an interview, help plan & run activities, and ALWAYS get top priority for all events, courses, workshops, and trips.\n- **General Members:** Join the community and attend activities without committee or organizational duties, based on available spots after Committee Members."
          : "فيه نوعين للعضوية في **Alexanders Group**:\n- **أعضاء اللجان (Committee Members):** بتنضم لإحدى اللجان الـ 6 بعد الانترفيو، وتشارك في تخطيط وتنفيذ الأنشطة والفعاليات، وليك دائماً **الأولوية المطلقة** في حضور كل الإيفنتات والكورسات والورش والرحلات.\n- **الأعضاء العامون (General Members):** بتكون جزء من عائلة الكيان وتحضر الأنشطة بدون الانضمام للجنة أو مسؤوليات تنظيمية، حسب الأماكن المتاحة وطبيعة النشاط بعد إعطاء الأولوية لأعضاء اللجان.",
      };
    }

    // 5. Members vs. The Board & Promotion Ladder
    if (
      /^(ايه )?(الفرق بين الاعضاء والبورد|الفرق بين العضو والبورد|الفرق بين البورد والاعضاء|الفرق بين member و(ال)?board|نظام الترقيات( في الكيان| في الكساندرز| في الكسندرز)?|ازاي اترقي( في الكيان| في الكساندرز| في الكسندرز)?|ايه هو البورد|مين هما البورد)$/.test(
        cleaned
      ) ||
      /^(what is the )?(difference between (committee )?members and (the )?board|promotion (ladder|system)|how (do i |to )?get promoted)( in alexanders( group)?)?$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Committee Members** are the operational backbone executing tasks and organizing activities, while **The Board** (Entity President, Vice Presidents, Committee Heads & Vice Heads) handles strategic planning, decision-making, and supervising committees.\n\n**Promotion Ladder** (earned by commitment & performance, not fixed time):\n1. Member\n2. Active Member\n3. Senior\n4. Vice Head (Lead)\n5. Head (Leader)"
          : "الفرق بين الأعضاء والبورد:\n- **أعضاء اللجان (Members):** هم العمود الفقري التشغيلي للكيان اللي بينفذوا المهام وينظموا الأنشطة جوا لجانهم.\n- **البورد (The Board):** قيادة الكيان واللجان (رئيس الكيان، نواب الرئيس، وهيدز وفايسز اللجان)، ومسؤولين عن التخطيط الاستراتيجي وإدارة الفرق واتخاذ القرارات.\n\n**نظام الترقيات** (حسب الالتزام والأداء مش بمدة ثابتة):\n1. Member\n2. Active Member\n3. Senior\n4. Vice Head (Lead)\n5. Head (Leader)",
      };
    }

    // 6. Eligibility (Who can join)
    if (
      /^(مين يقدر ينضم( للكيان| لالكساندرز| لالكسندرز)?|مين يقدر يقدم( في الكيان| في الكساندرز| في الكسندرز)?|ايه (هي )?شروط الانضمام( للكيان| لالكساندرز| لالكسندرز)?|شروط الانضمام( للكيان| لالكساندرز| لالكسندرز)?|شروط التقديم( للكيان| لالكساندرز| لالكسندرز)?|الفئات المتاحه للانضمام)$/.test(
        cleaned
      ) ||
      /^(who can join( alexanders( group)?)?|who is eligible( to join)?|what are the (eligibility )?requirements( to join)?|eligibility( requirements)?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Eligibility:** Open exclusively to undergraduate students in any faculty or academic year at **Alexandria University** or **Alexandria National University**.\n\n**Not Eligible:** Graduates, internship-year students (سنة الامتياز), institute students (المعاهد), or students from other universities."
          : "**شروط الانضمام:**\n- **متاح حصرياً لـ:** جميع طلاب المرحلة الجامعية بأي كلية أو فرقة في **جامعة الإسكندرية** و **جامعة الإسكندرية الأهلية**.\n- **غير متاح لـ:** الخريجين، طلبة سنة الامتياز، طلاب المعاهد، أو طلاب الجامعات الأخرى.",
      };
    }

    // 7. Committees List (6 Committees)
    if (
      /^(ايه هي |ما هي )?(لجان (الكيان|الكساندرز|الكسندرز|اليكساندرز)|اللجان( في الكيان| في الكساندرز| في الكسندرز| المتاحه)?|ال 6 لجان|الست لجان)$/.test(
        cleaned
      ) ||
      /^(what are (the )?committees( in alexanders( group)?)?|alexanders( group)? committees|list (of )?committees|committees)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "Alexanders operates through **6 integrated committees**:\n- **Organizing Committee (OC):** On-ground event management & logistics.\n- **Human Resources (HR):** Interviews, member tracking (HR Follower), & internal development.\n- **Public Relations (PR):** External partnerships, speakers, & sponsorships.\n- **Media (MD / ME):** Graphic Design, Video Editing & Montage, Photography/Videography, and Content Writing & Voiceover.\n- **Art / Handmade:** Recycling, Upcycling, eco-friendly projects, & event decor.\n- **Programming:** Technical support, websites, & digital solutions."
          : "كيان **ألكساندرز** بيشتغل من خلال **6 لجان أساسية**:\n- **لجنة التنظيم (OC):** الإدارة الميدانية واللوجستيات وتنفيذ الإيفنتات على أرض الواقع.\n- **لجنة الموارد البشرية (HR):** الانترفيوهات، متابعة وتقييم الأعضاء (HR Follower)، وتوفير بيئة عمل صحية.\n- **لجنة العلاقات العامة (PR):** التواصل الخارجي، عقد الشراكات، وتأمين الرعايات.\n- **لجنة الميديا (Media):** التصميم الجرافيكي، المونتاج، التصوير، وكتابة المحتوى والفويس أوفر.\n- **اللجنة الفنية / الهاند ميد (Art / Handmade):** الاستدامة البيئية، إعادة التدوير (Recycling & Upcycling)، وديكورات الفعاليات.\n- **لجنة البرمجة (Programming):** الدعم التقني وتطوير المواقع والحلول البرمجية.",
      };
    }

    // 8. How to Apply / Member Form / After Form
    if (
      /^(ازاي اقدم( في الكيان| في الكساندرز| في الكسندرز)?|ازاي انضم( للكيان| لالكساندرز| لالكسندرز)?|طريقه (التقديم|الانضمام)( للكيان| لالكساندرز| لالكسندرز)?|عايز (اقدم|انضم)|عاوز (اقدم|انضم)|فورم (التقديم|العضويه)|لينك (التقديم|الفورم)|رابط (التقديم|الفورم)|ايه اللي بيحصل بعد ما املا الفورم|بعد ما املا الفورم ايه اللي بيحصل)$/.test(
        cleaned
      ) ||
      /^(how (do i |to )?(apply|join)( alexanders( group)?)?|application form|join form|member(ship)? form|what happens after i (fill|submit) the form)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? `To join as a Committee Member:\n1. Fill out the form: [member_application_form](${MEMBER_FORM_URL})\n2. An HR team member will contact you via WhatsApp to schedule your interview time and location.\n3. Pass the committee interview to join as a Member!`
          : `خطوات الانضمام لعضوية اللجان في ألكساندرز:\n1. املا الفورم من هنا: [member_application_form](${MEMBER_FORM_URL})\n2. هيتواصل معاك مسؤول من لجنة الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو.\n3. بعد اجتياز المقابلة، بتنضم للجنة بصفة Member!`,
      };
    }

    // 9. Free Activities, Certificates & Transportation Allowances
    if (
      /^(هل )?(الكيان |النشاط |الانشطه |الكورسات |التدريبات |الاشتراك |الانشطه والكورسات |الكورسات والانشطه |الايفنتات والكورسات )?(مجاني|مجانيه|مجانا|بفلوس|في رسوم|فيه رسوم|في اشتراك|فيه اشتراك)$/.test(
        cleaned
      ) ||
      /^(الانشطه مجانيه|الكورسات مجانيه|هل في شهادات|هل فيه شهادات)$/.test(cleaned) ||
      /^(is it free|are (the )?(activities|courses|workshops|events|trainings) free|are there any fees|do you (give|provide) certificates)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "Yes! **100% of our activities, trainings, courses, workshops, sessions, and trips are completely free.** Most trainings include accredited certificates, and field visits often include transportation allowances."
          : "أيوه، **100% من الأنشطة، الكورسات، التدريبات، الورش، السيشنز، والرحلات مجانية بالكامل** بدون أي رسوم! وكمان معظم التدريبات بتقدم شهادات معتمدة، وكتير من الزيارات الميدانية بيكون فيها بدلات انتقال.",
      };
    }

    // 10. Studies, Exams & Attendance Policy
    if (
      /^(هل )?(الانضمام |الكيان |النشاط )?(هياثر علي (المذاكره|الدراسه|الكليه)|بياثر علي (المذاكره|الدراسه|الكليه)|في حضور يومي|فيه حضور يومي|الحضور يومي)$/.test(
        cleaned
      ) ||
      /^(will (it|joining) affect my studies|does (it|joining) affect my studies|is attendance daily|do i have to attend daily)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "Not at all! We don't require constant daily presence on campus, and we fully respect university schedules, exams, and personal circumstances as long as you communicate with your assigned HR Follower."
          : "أبداً، الانضمام مش بيأثر على المذاكرة أو الكلية! الحضور مش يومي، وفيه مرونة وتفهم كامل لمواعيد الجامعة والامتحانات والظروف الشخصية طالما فيه التزام بالمهام وتواصل مع الـ **HR Follower** الخاص بك.",
      };
    }

    // 11. About Alexanders Group (What is Alexanders)
    if (
      /^(ايه هو (كيان )?(الكساندرز|الكسندرز|اليكساندرز)|ايه هي جماعه (الكساندرز|الكسندرز|اليكساندرز)|مين انتم|مين انتو|عرفني (علي |عن )?(الكيان|الكساندرز|الكسندرز)|نبذه عن (الكيان|الكساندرز|الكسندرز)|ايه هدف الكيان|ايه رؤيه الكيان)$/.test(
        cleaned
      ) ||
      /^(what is alexanders( group)?|who are you|about alexanders( group)?|tell me about alexanders( group)?|what is your (mission|vision))$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? `**Alexanders Group** ("Together for a Sustainable Alexandria") is an official student entity under the General Administration of Youth Welfare (Student Families Department) at Alexandria University. More than just organizing events, our core mission is spreading **Sustainable Development** into real initiatives and bridging the gap between university life and the job market through free courses, workshops, events, and trips.`
          : `**جماعة أليكساندرز (Alexanders Group)** تحت شعار "معاً من أجل إسكندرية مستدامة" هو كيان طلابي رسمي تابع للإدارة العامة لرعاية الشباب (إدارة الأسر الطلابية) بجامعة الإسكندرية.\nألكساندرز مش مجرد نشاط طلابي بينظم إيفنتات عشوائية، هويته الأساسية هي نشر مفهوم **التنمية المستدامة** وتحويله لمبادرات ومشاريع عملية وأثر مجتمعي حقيقي، مع سد الفجوة بين الدراسة وسوق العمل بتدريبات وأنشطة مجانية 100%.`,
      };
    }

    // 12. Official Social Media Links & Video
    if (
      /^(ايه )?(صفحات (الكيان|الكساندرز|الكسندرز|التواصل|التواصل الرسميه)|الصفحات الرسميه|السوشيال ميديا|لينكات (السوشيال ميديا|التواصل)|روابط (السوشيال ميديا|التواصل)|صفحه (الفيسبوك|الفيس|الانستجرام|الانستا)|ازاي اتواصل معاكم|طرق التواصل|الفيديو التعريفي)$/.test(
        cleaned
      ) ||
      /^(social media( links)?|official (pages|links|channels)|contact( info| us)?|facebook( page| link)?|instagram( page| link)?|intro video)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? `Official Alexanders Group channels:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\n- [our_linkedin](${LINKEDIN_URL})\n- [our_tiktok](${TIKTOK_URL})\n- [our_youtube](${YOUTUBE_URL})\n- [our_intro_video](${INTRO_VIDEO_URL})`
          : `الصفحات الرسمية لكيان ألكساندرز:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\n- [our_linkedin](${LINKEDIN_URL})\n- [our_tiktok](${TIKTOK_URL})\n- [our_youtube](${YOUTUBE_URL})\n- [our_intro_video](${INTRO_VIDEO_URL})`,
      };
    }

    // 13. Organizing Committee (OC)
    if (
      /^(ايه )?(دور |مهام |تفاصيل |عن )?(لجنه التنظيم( oc)?|لجنه ال oc|لجنه oc|oc committee)$/.test(
        cleaned
      ) ||
      /^(what (is|does) (the )?(oc|organizing committee)( do| role)?|tell me about (oc|organizing committee))$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Organizing Committee (OC - لجنة التنظيم):**\n- **Role:** Field management and logistics — planning, organizing, and executing events, conferences, and trips on the ground, maintaining order, and handling unexpected on-site situations quickly.\n- **Ideal Traits:** Strong organization skills, quick problem-solving, working well under pressure, teamwork, and high on-ground energy."
          : "**لجنة التنظيم (Organizing Committee - OC):**\n- **الدور والمهام:** الإدارة الميدانية واللوجستيات؛ مسؤولة عن تخطيط وتنظيم وتنفيذ الإيفنتات والمؤتمرات والرحلات على أرض الواقع، وحفظ النظام، والتعامل السريع والهادئ مع أي مواقف طارئة.\n- **المهارات المطلوبة:** مهارات تنظيمية قوية، سرعة حل المشكلات، العمل تحت ضغط، روح الفريق، والنشاط الميداني.",
      };
    }

    // 14. Human Resources Committee (HR)
    if (
      /^(ايه )?(دور |مهام |تفاصيل |عن )?(لجنه الموارد البشريه( hr)?|لجنه ال hr|لجنه hr|ال hr|hr committee)$/.test(
        cleaned
      ) ||
      /^(what (is|does) (the )?(hr|human resources)( committee)?( do| role)?|tell me about (hr|human resources)( committee)?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Human Resources Committee (HR - لجنة الموارد البشرية):**\n- **Role:** People management and internal development — running recruitment interviews, tracking and evaluating member performance, maintaining a healthy team environment, and assigning an **HR Follower** to support each member.\n- **Ideal Traits:** Good communication, active listening, objectivity, fairness, empathy, and follow-up skills."
          : "**لجنة الموارد البشرية (Human Resources - HR):**\n- **الدور والمهام:** إدارة الأفراد والتطوير الداخلي؛ مسؤولة عن مقابلات التقديم (Interviews)، متابعة وتقييم أداء الأعضاء، توفير بيئة عمل صحية، وتخصيص **HR Follower** لدعم كل عضو.\n- **المهارات المطلوبة:** التواصل الفعال، الاستماع الجيد، الموضوعية والحيادية، التعاطف، والقدرة على المتابعة وحل المشكلات.",
      };
    }

    // 15. Public Relations Committee (PR)
    if (
      /^(ايه )?(دور |مهام |تفاصيل |عن )?(لجنه العلاقات العامه( pr)?|لجنه ال pr|لجنه pr|ال pr|pr committee)$/.test(
        cleaned
      ) ||
      /^(what (is|does) (the )?(pr|public relations)( committee)?( do| role)?|tell me about (pr|public relations)( committee)?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Public Relations Committee (PR - لجنة العلاقات العامة):**\n- **Role:** Official external representation — communicating with external institutions, speakers, and sponsors, building strategic partnerships, and securing sponsorships.\n- **Ideal Traits:** Strong negotiation and persuasion skills, confidence, formal communication etiquette, networking, and representing Alexanders professionally."
          : "**لجنة العلاقات العامة (Public Relations - PR):**\n- **الدور والمهام:** التمثيل الرسمي والتواصل الخارجي؛ مسؤولة عن التواصل مع الجهات والمؤسسات الخارجية والمتحدثين والرعاة، وبناء الشراكات الاستراتيجية، وتأمين الرعايات للكيان.\n- **المهارات المطلوبة:** مهارات التفاوض والإقناع، الثقة بالنفس، لباقة التواصل الرسمي، وبناء العلاقات (Networking).",
      };
    }

    // 16. Media Committee (MD / ME)
    if (
      /^(ايه )?(دور |مهام |تفاصيل |اقسام |تراكات |عن )?(لجنه الميديا( والاعلام)?( media)?|لجنه الاعلام|لجنه ال media|لجنه media|الميديا|media committee)$/.test(
        cleaned
      ) ||
      /^(what (is|does) (the )?media( committee)?( do| role)?|tell me about (the )?media( committee)?|media tracks)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Media Committee (MD / ME - لجنة الميديا والإعلام):**\n- **Role:** Digital production, content creation, and visual identity covering events and managing online presence.\n- **4 Sub-tracks:**\n  1. **Graphic Design**\n  2. **Video Editing & Montage**\n  3. **Photography & Videography**\n  4. **Content Writing, Copywriting & Voiceover**\n- **Ideal Traits:** Creativity, visual sense, familiarity with design/editing/camera tools, or strong creative writing and storytelling."
          : "**لجنة الميديا والإعلام (Media Committee):**\n- **الدور والمهام:** الإنتاج الرقمي وصناعة المحتوى والهوية البصرية وتغطية الفعاليات.\n- **الأقسام الفرعية (4 تراكات):**\n  1. **التصميم الجرافيكي (Graphic Design)**\n  2. **المونتاج وتحرير الفيديو (Video Editing & Montage)**\n  3. **التصوير والتوثيق المرئي (Photography & Videography)**\n  4. **كتابة المحتوى والفويس أوفر (Content Writing & Voiceover)**\n- **المهارات المطلوبة:** حس إبداعي وبصري، معرفة أساسية أو متوسطة بأدوات التصميم/المونتاج/التصوير، أو مهارة في الكتابة الإبداعية والسرد.",
      };
    }

    // 17. Art / Handmade Committee
    if (
      /^(ايه )?(دور |مهام |تفاصيل |عن )?(اللجنه الفنيه( والهاند ميد)?|لجنه الهاند ميد|لجنه الفن|الفنيه والهاند ميد|الهاند ميد|art committee|handmade committee)$/.test(
        cleaned
      ) ||
      /^(what (is|does) (the )?(art|handmade|art and handmade)( committee)?( do| role)?|tell me about (the )?(art|handmade)( committee)?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Art / Handmade Committee (اللجنة الفنية / الهاند ميد):**\n- **Role:** Environmental sustainability through creative arts, **Recycling**, **Upcycling**, eco-friendly projects, and designing/executing event decorations.\n- **Ideal Traits:** Passion for handmade crafts, creativity, interest in environmental sustainability and recycling, and attention to artistic detail."
          : "**اللجنة الفنية / الهاند ميد (Art / Handmade Committee):**\n- **الدور والمهام:** ركيزة أساسية في هوية ألكساندرز البيئية؛ بتركز على الاستدامة البيئية، **إعادة التدوير (Recycling)**، **إعادة الاستخدام الإبداعي للخامات (Upcycling)**، تقليل المخلفات، وتصميم وتنفيذ ديكورات الفعاليات.\n- **المهارات المطلوبة:** شغف بالأعمال اليدوية والفنية، الإبداع، الاهتمام بالاستدامة البيئية وإعادة التدوير، والدقة الفنية.",
      };
    }

    // 18. Programming Committee
    if (
      /^(ايه )?(دور |مهام |تفاصيل |عن )?(لجنه البرمجه( programming)?|البرمجه|لجنه ال programming|programming committee)$/.test(
        cleaned
      ) ||
      /^(what (is|does) (the )?programming( committee)?( do| role)?|tell me about (the )?programming( committee)?)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Programming Committee (لجنة البرمجة):**\n- **Role:** Technical support and software/web development — building and maintaining websites, digital tools, platforms, and tech infrastructure for the entity and its events.\n- **Ideal Traits:** Interest or background in web development, programming languages, and problem-solving (open to both enthusiastic learners and experienced student developers)."
          : "**لجنة البرمجة (Programming Committee):**\n- **الدور والمهام:** الدعم التقني وتطوير البرمجيات والمواقع؛ مسؤولة عن بناء وتطوير المواقع الإلكترونية، الأدوات التقنية، والمنصات الرقمية الخاصة بالكيان وفعالياته.\n- **المهارات المطلوبة:** شغف أو خلفية في تطوير الويب ولغات البرمجة وحل المشكلات (متاحة للطلاب الراغبين في التعلم والتطبيق وكذلك المطورين ذوي الخبرة).",
      };
    }

    // 19. HR Follower, 3-Strikes Warning Policy & Member of the Month (VIP)
    if (
      /^(ايه )?(هو )?(نظام ال hr follower( والانذارات)?|ال hr follower|سياسه الانذارات|نظام الانذارات|الانذارات|العضو المميز|member of the month|hr follower( system)?|warning policy|3 strikes)$/.test(
        cleaned
      ) ||
      /^(what is (the )?(hr follower( system)?|warning policy|3 strikes policy|member of the month))$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**HR Support, Warnings & Recognition Policy:**\n- **HR Follower System:** Every committee member gets a dedicated HR Follower who supports them step-by-step and helps balance university studies with entity tasks.\n- **3-Strikes Warning Policy:** Members receive up to 3 warnings (Strikes) only if they ignore their HR Follower, repeatedly miss meetings without a valid excuse, or neglect tasks without communicating. A 3rd strike results in removal (Filtration). Valid academic or personal excuses are always respected when communicated!\n- **Member of the Month (VIP):** The most active member each month is honored publicly and receives VIP priority in all activities."
          : "**نظام المتابعة (HR Follower) والإنذارات والتكريم:**\n- **HR Follower:** لكل عضو في اللجان مسؤول متابعة مخصص بيدعمه خطوة بخطوة ويساعده يحل أي عقبة ويوازن بين الكلية والكيان.\n- **سياسة الـ 3 إنذارات (3-Strikes Policy):** بيحصل العضو على إنذار فقط في حالة تجاهل الـ HR Follower (\"الكرف\") أو الغياب المتكرر وإهمال المهام بدون عذر أو تواصل، وعند الإنذار الثالث يتم الإعفاء (Filtration). أما الأعذار الحقيقية زي الامتحانات وضغط الدراسة فمقدّرة تماماً طالما فيه تواصل.\n- **العضو المميز (Member of the Month - VIP):** بيتكرم أنشط عضو شهرياً قدام الكيان كله وبيحصل على أولوية وتسهيلات VIP في جميع الأنشطة.",
      };
    }

    // 20. Past Events, Initiatives & Achievements
    if (
      /^(ايه )?(ابرز |اهم )?(ايفنتات وانجازات الكيان|انجازات الكيان|ايفنتات الكيان|انشطه الكيان السابقه|فعاليات الكيان|دوري العقول الخضراء|نادي اللغات|قاده الاخضر|خلي المذاكره لعبتك)$/.test(
        cleaned
      ) ||
      /^(what are (the )?(past events|achievements|initiatives|programs)( of alexanders)?|alexanders achievements|green minds league|language club)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Key Alexanders Events, Programs & Achievements:**\n- **Green Minds League:** Environmental & critical-thinking competition with Bibliotheca Alexandrina across 14 faculties (Alexanders won **2nd Place** overall).\n- **Plastic-Free University Celebration:** Major World Environment Day event with the Ministry of Youth and Sports.\n- **Climate Change TOT:** 2-day Training of Trainers at the Faculty of Pharmacy with **ICESCO**.\n- **Green Leaders Program:** 3-day intensive training on green energy & green economy.\n- **Greenovate Hackathon & Freelancing Training:** In partnership with **Creativa Hub Alexandria (ITIDA/TIEC)**.\n- **Alexanders Language Club:** Practical speaking in **English, Turkish, and Chinese**.\n- **\"خلي المذاكرة لعبتك\" (1 & 2):** Exam-season study & time-management sessions.\n- **Field & Cultural Visits:** Arab Sustainability Expo (Cairo), Cairo International Book Fair, Cavafy Museum, and Anfoushi Beach Cleanup (100+ students)."
          : "**أبرز إيفنتات ومبادرات وإنجازات كيان ألكساندرز:**\n- **دوري العقول الخضراء (Green Minds League):** أول مسابقة جامعية تجمع بين الوعي البيئي والتفكير النقدي بالتعاون مع مكتبة الإسكندرية بمشاركة 14 كلية (فاز فريق ألكساندرز **بالمركز الثاني**).\n- **احتفالية \"جامعة بلا بلاستيك\":** في اليوم العالمي للبيئة بمسرح المدينة الجامعية بالتعاون مع وزارة الشباب والرياضة.\n- **تدريب إعداد المدربين للمناخ (TOT):** بكلية الصيدلة بالتعاون مع منظمة **الإيسيسكو (ICESCO)**.\n- **برنامج قادة الأخضر (Green Leaders):** تدريب مكثف لمدة 3 أيام عن الطاقة الخضراء والاقتصاد الأخضر.\n- **هاكاثون Greenovate وتدريب العمل الحر (Freelancing):** بالتعاون مع **Creativa Hub Alexandria**.\n- **نادي اللغات (Language Club):** لممارسة المحادثة بـ 3 لغات (**الإنجليزية، التركية، والصينية**).\n- **سيشنز \"خلي المذاكرة لعبتك\" (1 و2):** لدعم الطلاب في تنظيم الوقت والمذاكرة فترة الامتحانات.\n- **زيارات ومبادرات ميدانية:** المعرض العربي للاستدامة بالقاهرة، معرض القاهرة الدولي للكتاب، متحف كفافيس، وحملة تنظيف شاطئ سيد درويش بالأنفوشي بمشاركة أكثر من 100 طالب.",
      };
    }

    // 21. Key Partners & Collaborations
    if (
      /^(مين )?(هم |هما )?(شركاء (كيان )?(الكساندرز|الكسندرز|الكيان)|الشركاء|تعاونات الكيان|شراكات الكيان)$/.test(
        cleaned
      ) ||
      /^(who are (your |alexanders )?partners|key partners|collaborations|partnerships)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Key Partners & Collaborations:**\n- **Bibliotheca Alexandrina** (مكتبة الإسكندرية)\n- **Ministry of Youth and Sports** (وزارة الشباب والرياضة)\n- **ICESCO** (منظمة الإيسيسكو)\n- **Arab Union for Sustainable Development and Environment**\n- **Our Earth Climate Foundation for Sustainable Development**\n- **Creativa Hub Alexandria (ITIDA / TIEC)**\n- **Anna Lindh Foundation & Green Opportunities Initiative** (EU-funded)\n- **Alexandria University Youth Entity & Tourism Lovers Group**"
          : "**أبرز شركاء وتعاونات كيان ألكساندرز:**\n- **مكتبة الإسكندرية (Bibliotheca Alexandrina)**\n- **وزارة الشباب والرياضة**\n- **منظمة الإيسيسكو (ICESCO)**\n- **الاتحاد العربي للتنمية المستدامة والبيئة**\n- **مؤسسة مناخ أرضنا للتنمية المستدامة**\n- **مراكز إبداع مصر الرقمية (Creativa Hub Alexandria - ITIDA / TIEC)**\n- **مؤسسة أنا ليندا ومبادرة فرص خضراء** (الممولة من الاتحاد الأوروبي)\n- **كيان شباب جامعة الإسكندرية وجماعة محبي السياحة**",
      };
    }

    // 22. Official Affiliation, Supervision & Location
    if (
      /^(الكيان تابع لمين( ومكانه فين)?|تبعيه الكيان|اشراف الكيان|مقر الكيان|مكان الكيان فين|الكيان فين|مين مشرف علي الكيان)$/.test(
        cleaned
      ) ||
      /^(where is alexanders located|official affiliation|who supervises alexanders|location of alexanders)$/.test(
        cleaned
      )
    ) {
      return {
        isGreeting: false,
        reply: isEn
          ? "**Official Affiliation, Supervision & Location:**\n- **Affiliation:** An official student entity under the **General Administration of Youth Welfare — Student Families Department** at **Alexandria University**.\n- **Patronage & Supervision:** Under the patronage of the University President (**Prof. Dr. Abdelaziz Konsowa**) and direct supervision of the Vice President for Education & Student Affairs (**Prof. Dr. Ahmed Adel Abdel Hakim**), with academic and administrative support from **Mr. Mohamed Fawzy** (Director of Student Families Dept.), **Prof. Dr. Hassan Abdeen**, **Prof. Dr. Amani El-Sawy**, and **Prof. Dr. Magdy Agamia**.\n- **Location:** Student Activities Complex — General Administration of Youth Welfare, Alexandria University."
          : "**التبعية الرسمية والإشراف والمقر:**\n- **التبعية القانونية:** كيان طلابي رسمي تابع **للإدارة العامة لرعاية الشباب - إدارة الأسر الطلابية بجامعة الإسكندرية**.\n- **الرعاية والإشراف:** تحت رعاية رئيس الجامعة (**أ.د/ عبد العزيز قنصوه**) وإشراف مباشر من نائب رئيس الجامعة لشئون التعليم والطلاب (**أ.د/ أحمد عادل عبد الحكيم**)، وبدعم إداري وأكاديمي من **أ. محمد فوزي** (مدير إدارة الأسر الطلابية)، **د. حسن عابدين** (عميد كلية التربية)، **د. أماني الصاوي** (رئيس قسم اللغة الإنجليزية)، و **أ.د/ مجدي عجمية** (رئيس قسم اللغات الشرقية).\n- **المقر:** مجمع الأنشطة الطلابية - الإدارة العامة لرعاية الشباب، جامعة الإسكندرية.",
      };
    }

    return null;
  }

  async function sendMessage(rawText, options = {}) {
    const { fromFaqChip = false } = options;
    const userText = (rawText || "").trim();
    if (!userText || isBusy) return;

    // Instant, zero-auth FAQ reply strictly for signed-out users on exact FAQ matches or FAQ chips
    if (!isUserSignedIn()) {
      const faqMatch = matchFaqReply(userText, {
        fromFaqChip,
        allowTopicalFaq: fromFaqChip || !hasTopicalHistory,
      });
      if (faqMatch) {
        hideAuthPrompt();
        setFaqCollapsed(true);
        pendingMessage = null;
        appendMessage("user", userText);
        if (dom.input) dom.input.value = "";
        appendMessage("assistant", faqMatch.reply);

        conversationHistory.push({ role: "user", content: userText });
        conversationHistory.push({ role: "assistant", content: faqMatch.reply });
        if (!faqMatch.isGreeting) {
          hasTopicalHistory = true;
        }
        if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
          conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
        }

        if (dom.input) dom.input.focus();
        scrollToBottom();
        return;
      }
    }

    if (!isPuterAvailable()) {
      appendMessage(
        "assistant",
        "تعذر تحميل خدمة المحادثة (Puter.js). تأكد من اتصالك بالإنترنت أو تعطيل مانع الإعلانات مؤقتاً ثم أعد تحميل الصفحة.",
        { isError: true }
      );
      return;
    }

    // User-Pays gate: show the sign-in card; the user's click on its button opens Puter sign-in
    if (!isUserSignedIn()) {
      setFaqCollapsed(true);
      pendingMessage = userText;
      showAuthPrompt();
      return;
    }

    hideAuthPrompt();
    setFaqCollapsed(true);
    const activeNonce = sessionNonce;

    appendMessage("user", userText);
    if (dom.input) dom.input.value = "";
    setBusy(true);

    const assistantNode = appendMessage("assistant", "", { isTyping: true });

    try {
      let kbText;
      try {
        kbText = await loadKnowledgeBase();
      } catch (kbErr) {
        throw new Error(
          `تعذر تحميل ملف المعلومات (${KB_URL}). تأكد من فتح الموقع عبر خادم محلي أو استضافة ويب.`
        );
      }

      if (activeNonce !== sessionNonce) return;

      const messagesPayload = [
        { role: "system", content: buildSystemPrompt(kbText) },
        ...conversationHistory.slice(-MAX_HISTORY_MESSAGES),
        { role: "user", content: userText },
      ];

      let dirSet = false;
      const finalReply = await streamPuterReply(
        messagesPayload,
        (partialText) => {
          if (activeNonce !== sessionNonce || !assistantNode) return;
          const dir = detectDirection(partialText);
          if (!dirSet && partialText.trim().length > 0) {
            dirSet = true;
          }
          assistantNode.msgEl.setAttribute("dir", dir);
          assistantNode.bodyEl.setAttribute("dir", dir);
          assistantNode.bodyEl.classList.add("alex-chat-streaming");
          assistantNode.bodyEl.innerHTML = renderMarkdown(partialText);
          scrollToBottom();
        },
        activeNonce
      );

      if (activeNonce !== sessionNonce) return;
      assistantNode?.bodyEl.classList.remove("alex-chat-streaming");

      if (!finalReply) {
        assistantNode?.msgEl.remove();
        return;
      }

      const finalDir = detectDirection(finalReply);
      assistantNode.msgEl.setAttribute("dir", finalDir);
      assistantNode.bodyEl.setAttribute("dir", finalDir);
      assistantNode.bodyEl.innerHTML = renderMarkdown(finalReply);

      conversationHistory.push({ role: "user", content: userText });
      conversationHistory.push({ role: "assistant", content: finalReply });
      hasTopicalHistory = true;
      if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
      }
    } catch (err) {
      if (activeNonce !== sessionNonce) return;
      assistantNode?.bodyEl.classList.remove("alex-chat-streaming");

      if (isAuthRelatedError(err)) {
        pendingMessage = userText;
        assistantNode?.msgEl.remove();
        refreshAuthUI();
        showAuthPrompt("انتهت صلاحية الجلسة أو يلزم تسجيل الدخول بحساب Google / Puter للمتابعة.");
      } else {
        const msg =
          err?.message && /file|http|تعذر/i.test(err.message)
            ? err.message
            : `حدث خطأ أثناء الاتصال بالمساعد الذكي. يمكنك المحاولة مرة أخرى أو التواصل معنا عبر [our_facebook](${FB_URL})`;
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
  // 6. DOM Mounting & Event Wiring
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
                <span id="alexChatStatusText">جاهز للدردشة</span>
              </div>
            </div>
          </div>
          <div class="alex-chat-header-actions">
            <button type="button" id="alexChatAuthPill" class="alex-chat-auth-pill" hidden title="تسجيل الدخول بحساب Google أو Puter">
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
          <p class="alex-chat-auth-title">تسجيل دخول مجاني للأسئلة المفتوحة</p>
          <p class="alex-chat-auth-desc">
            الأسئلة الشائعة متاحة بدون تسجيل دخول! للأسئلة المفتوحة، اضغط الزر وسجّل الدخول مجاناً بحساب Google أو Puter في النافذة اللي هتفتح.
          </p>
          <p class="alex-chat-auth-subdesc">FAQs work without sign-in. For open-ended questions, click below and sign in free with Google or Puter in the window that opens.</p>
          <p id="alexChatAuthError" class="alex-chat-auth-error" hidden></p>
          <div class="alex-chat-auth-actions">
            <button type="button" id="alexChatSignInBtn" class="alex-chat-signin-btn">
              تسجيل الدخول (Google / Puter)
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

    // Populate quick-starter chips with smooth wheel-to-horizontal scroll
    QUICK_CHIPS.forEach((question) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "alex-chat-chip";
      chip.textContent = question;
      chip.addEventListener("click", () => {
        if (isBusy) return;
        sendMessage(question, { fromFaqChip: true });
      });
      dom.chips.appendChild(chip);
    });

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

    // Initial welcome bubble
    appendMessage("assistant", WELCOME_MESSAGE);

    // Floating open/close wiring
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
    dom.authPill?.addEventListener("click", () =>
      triggerPuterSignIn({ requestAuth: isUserSignedIn() })
    );
    dom.signInBtn?.addEventListener("click", () => triggerPuterSignIn());
    dom.authDismissBtn?.addEventListener("click", () => {
      pendingMessage = null;
      hideAuthPrompt();
    });

    dom.form?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = dom.input?.value?.trim();
      if (!text) return;
      sendMessage(text);
    });

    // Pre-warm KB fetch and sync auth status on init
    loadKnowledgeBase().catch((err) => {
      console.warn("[Alexanders Chat] Initial KB preload failed:", err.message);
    });
    refreshAuthUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountChatWidget);
  } else {
    mountChatWidget();
  }
})();
