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
    "إيه هي لجان ألكسندرز؟",
    "مين يقدر ينضم للكيان؟",
    "إيه الفرق بين Member و General Member؟",
    "إيه الفرق بين الأعضاء والبورد؟",
    "إزاي أقدم؟",
  ];

  const WELCOME_MESSAGE =
    "أهلاً بك في مجتمع **ألكساندرز (Alexanders Group)** بجامعة الإسكندرية! 👋\n" +
    "تقدر تسأل الأسئلة الشائعة فوراً بدون تسجيل دخول، وللأسئلة المفتوحة سجّل دخول مجاني بضغطة واحدة.\n" +
    "FAQs work immediately without sign-in; open-ended AI questions use a free 1-click sign-in.";

  // Runtime state
  let kbTextCache = null;
  let kbPromise = null;
  let conversationHistory = [];
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
          if (user?.username) {
            dom.statusText.textContent = `متصل • ${user.username}`;
          }
        }
      } catch {
        // Keep generic connected label if user lookup fails
      }
    } else {
      dom.statusText.textContent = "جاهز للدردشة";
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

  function handleSignInClick() {
    if (!isPuterAvailable()) {
      showAuthPrompt("تعذر تحميل خدمة Puter.js. تأكد من اتصالك بالإنترنت ثم أعد المحاولة.");
      return;
    }

    if (dom.signInBtn) dom.signInBtn.disabled = true;
    if (dom.authError) dom.authError.hidden = true;

    // Trigger signIn() synchronously inside direct click handler to avoid popup blockers
    let signInPromise;
    try {
      signInPromise = window.puter.auth.signIn();
    } catch (err) {
      if (dom.signInBtn) dom.signInBtn.disabled = false;
      showAuthPrompt("المتصفح منع نافذة تسجيل الدخول (Popup blocked). اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.");
      return;
    }

    Promise.resolve(signInPromise)
      .then(() => {
        if (dom.signInBtn) dom.signInBtn.disabled = false;
        if (!isUserSignedIn()) {
          showAuthPrompt("لم يكتمل تسجيل الدخول. اضغط على الزر للمحاولة مرة أخرى.");
          return;
        }
        hideAuthPrompt();
        refreshAuthUI();

        if (pendingMessage) {
          const nextMsg = pendingMessage;
          pendingMessage = null;
          sendMessage(nextMsg);
        }
      })
      .catch((err) => {
        if (dom.signInBtn) dom.signInBtn.disabled = false;
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
      `5. Out-of-Scope Escalation: If a question is not covered in the Knowledge Base, politely state that you do not have that information (matching the user's language) and direct the student to message Alexanders Group on Facebook ${FB_URL} or Instagram ${IG_URL} for accurate details.`,
      "6. Links Formatting: Always output URLs cleanly as full https:// links (avoid placing parentheses immediately around URLs so they stay clickable).",
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

  function applyInlineMarkdown(escapedLine) {
    // Strip PUA sentinel range if present in user text so placeholders stay unambiguous
    let line = escapedLine.replace(/[\uE000\uE001]/g, "");
    const linkPlaceholders = [];

    // 1. Protect explicit Markdown links [label](https://...)
    line = line.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
      const idx = linkPlaceholders.length;
      linkPlaceholders.push(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
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
      linkPlaceholders.push(`<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`);
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

  function resetChat() {
    sessionNonce++;
    conversationHistory = [];
    pendingMessage = null;
    hideAuthPrompt();
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

  function matchFaqReply(rawText) {
    const norm = normalizeForFaq(rawText);
    if (!norm || norm.length > 110) return null;

    // Leave personal coaching, committee recommendation, or interview prep to full AI
    if (
      /(انصحني|تناسبني|مناسب ليا|محتار|مهاراتي|اجهز للانترفيو|استعد|interview tips|prepare for interview|which committee fits|recommend|advice|suitable for me)/.test(
        norm
      )
    ) {
      return null;
    }

    const isEn = detectDirection(rawText) === "ltr";

    // 1. Greetings & Thanks
    if (
      /^(hi|hello|hey|yo|hola|good morning|good evening|اهلا|اهلا وسهلا|مرحبا|السلام عليكم|سلام عليكم|ازيك|ازيكم|عامل ايه|عاملين ايه|صباح الخير|مساء الخير|هالو|هاي|الو)$/.test(
        norm
      )
    ) {
      return isEn
        ? "Hello and welcome to **Alexanders Group** at Alexandria University! 👋 How can I help you today? You can ask me about our 6 committees, eligibility, membership types, or how to apply."
        : "أهلاً بك في كيان **ألكساندرز (Alexanders Group)**! 👋 إزاي أقدر أساعدك النهاردة؟ تقدر تسألني عن اللجان الـ 6، شروط الانضمام، الفرق بين أنواع العضوية، أو طريقة التقديم.";
    }

    if (
      /^(thanks|thank you|thx|ty|ok|okay|cool|great|bye|goodbye|شكرا|متشكر|تسلم|تسلم ايدك|الف شكر|يعطيك العافيه|تمام|ماشي|اوكي|باي|سلام)$/.test(
        norm
      )
    ) {
      return isEn
        ? "You're welcome! Feel free to ask anytime if you have more questions about Alexanders Group."
        : "العفو! لو عندك أي سؤال تاني عن كيان ألكساندرز أو اللجان، أنا موجود دايماً.";
    }

    // 2. Zero Dates / Deadlines Rule (checked BEFORE application/committees)
    if (
      /(امتي|امتا|ميعاد|مواعيد|متي |متى |ديدلاين|مفتوح|فتح التقديم|موعد|when is|when does|deadline|dates|open now|registration open)/.test(
        norm
      )
    ) {
      return isEn
        ? `Schedules and dates for recruitment, interviews, courses, and events are announced dynamically on our official social media pages (not fixed in advance). Follow us for updates:\n- Facebook: ${FB_URL}\n- Instagram: ${IG_URL}\nIf you already submitted the form, an HR team member will contact you via WhatsApp to arrange your interview.`
        : `مواعيد التقديم، الانترفيوهات، الكورسات، والفعاليات بتُعلن بشكل متجدد أول بأول على صفحاتنا الرسمية مش بمواعيد ثابتة:\n- فيسبوك: ${FB_URL}\n- إنستجرام: ${IG_URL}\nوبالنسبة للي ملأ الفورم بالفعل، بيتواصل معاه مسؤول من الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو.`;
    }

    // 3. Board Application Form ONLY when specifically asked about applying for Board
    if (
      /(تقديم.*بورد|اقدم.*بورد|فورم.*بورد|رابط.*بورد|لينك.*بورد|apply.*board|board.*form|board.*application)/.test(
        norm
      )
    ) {
      return isEn
        ? `You can apply for **The Board** through the Board Application Form here:\n${BOARD_FORM_URL}\nAfter submitting the form, an HR representative will contact you via WhatsApp to schedule your interview date, time, and location.`
        : `تقدر تقدم على **البورد (Board)** من خلال فورم التقديم للبورد هنا:\n${BOARD_FORM_URL}\nوبعد ملء الفورم، هيتواصل معاك ممثل من لجنة الـ HR على واتساب لتحديد ميعاد ومكان المقابلة.`;
    }

    // 4. Committee Member vs. General Member
    if (
      /(general member|committee member|عضو عام|اعضاء اللجان|انواع العضويه|member و general|الفرق بين member|الفرق بين العام|difference between.*member)/.test(
        norm
      )
    ) {
      return isEn
        ? "We have **2 membership types**:\n- **Committee Members:** Join 1 of our 6 committees after passing an interview, help plan & run activities, and ALWAYS get top priority for all events, courses, workshops, and trips.\n- **General Members:** Join the community and attend activities without committee or organizational duties, based on available spots after Committee Members."
        : "فيه نوعين للعضوية في **Alexanders Group**:\n- **أعضاء اللجان (Committee Members):** بتنضم لإحدى اللجان الـ 6 بعد الانترفيو، وتشارك في تخطيط وتنفيذ الأنشطة والفعاليات، وليك دائماً **الأولوية المطلقة** في حضور كل الإيفنتات والكورسات والورش والرحلات.\n- **الأعضاء العامون (General Members):** بتكون جزء من عائلة الكيان وتحضر الأنشطة بدون الانضمام للجنة أو مسؤوليات تنظيمية، حسب الأماكن المتاحة وطبيعة النشاط بعد إعطاء الأولوية لأعضاء اللجان.";
    }

    // 5. Members vs. The Board & Promotion Ladder
    if (
      /(الفرق بين الاعضاء والبورد|الفرق بين العضو والبورد|الاعضاء والبورد|البورد|بورد|board|ترقيات|الترقيه|ترقيه|promotion|vice head|active member)/.test(
        norm
      )
    ) {
      return isEn
        ? "**Committee Members** are the operational backbone executing tasks and organizing activities, while **The Board** (Entity President, Vice Presidents, Committee Heads & Vice Heads) handles strategic planning, decision-making, and supervising committees.\n\n**Promotion Ladder** (earned by commitment & performance, not fixed time):\n1. Member\n2. Active Member\n3. Senior\n4. Vice Head (Lead)\n5. Head (Leader)"
        : "الفرق بين الأعضاء والبورد:\n- **أعضاء اللجان (Members):** هم العمود الفقري التشغيلي للكيان اللي بينفذوا المهام وينظموا الأنشطة جوا لجانهم.\n- **البورد (The Board):** قيادة الكيان واللجان (رئيس الكيان، نواب الرئيس، وهيدز وفايسز اللجان)، ومسؤولين عن التخطيط الاستراتيجي وإدارة الفرق واتخاذ القرارات.\n\n**نظام الترقيات** (حسب الالتزام والأداء مش بمدة ثابتة):\n1. Member\n2. Active Member\n3. Senior\n4. Vice Head (Lead)\n5. Head (Leader)";
    }

    // 6. Eligibility (Who can join)
    if (
      /(مين يقدر ينضم|مين يقدر يقدم|شروط الانضمام|الفئات المتاحه|ينفع اقدم|ينفع انضم|خريج|امتياز|معهد|معاهد|جامعه اهليه|جامعه تانيه|who can join|eligib|graduate|other universit)/.test(
        norm
      )
    ) {
      return isEn
        ? "**Eligibility:** Open exclusively to undergraduate students in any faculty or academic year at **Alexandria University** or **Alexandria National University**.\n\n**Not Eligible:** Graduates, internship-year students (سنة الامتياز), institute students (المعاهد), or students from other universities."
        : "**شروط الانضمام:**\n- **متاح حصرياً لـ:** جميع طلاب المرحلة الجامعية بأي كلية أو فرقة في **جامعة الإسكندرية** و **جامعة الإسكندرية الأهلية**.\n- **غير متاح لـ:** الخريجين، طلبة سنة الامتياز، طلاب المعاهد، أو طلاب الجامعات الأخرى.";
    }

    // 7. Committees List (6 Committees)
    if (
      /(ايه هي لجان|ما هي لجان|اللجان|لجان الكيان|لجان الكساندرز|6 لجان|ست لجان|committees|what are the committees)/.test(
        norm
      )
    ) {
      return isEn
        ? "Alexanders operates through **6 integrated committees**:\n- **Organizing Committee (OC):** On-ground event management & logistics.\n- **Human Resources (HR):** Interviews, member tracking (HR Follower), & internal development.\n- **Public Relations (PR):** External partnerships, speakers, & sponsorships.\n- **Media (MD / ME):** Graphic Design, Video Editing & Montage, Photography/Videography, and Content Writing & Voiceover.\n- **Art / Handmade:** Recycling, Upcycling, eco-friendly projects, & event decor.\n- **Programming:** Technical support, websites, & digital solutions."
        : "كيان **ألكساندرز** بيشتغل من خلال **6 لجان أساسية**:\n- **لجنة التنظيم (OC):** الإدارة الميدانية واللوجستيات وتنفيذ الإيفنتات على أرض الواقع.\n- **لجنة الموارد البشرية (HR):** الانترفيوهات، متابعة وتقييم الأعضاء (HR Follower)، وتوفير بيئة عمل صحية.\n- **لجنة العلاقات العامة (PR):** التواصل الخارجي، عقد الشراكات، وتأمين الرعايات.\n- **لجنة الميديا (Media):** التصميم الجرافيكي، المونتاج، التصوير، وكتابة المحتوى والفويس أوفر.\n- **اللجنة الفنية / الهاند ميد (Art / Handmade):** الاستدامة البيئية، إعادة التدوير (Recycling & Upcycling)، وديكورات الفعاليات.\n- **لجنة البرمجة (Programming):** الدعم التقني وتطوير المواقع والحلول البرمجية.";
    }

    // 8. How to Apply / Member Form / After Form
    if (
      /(ازاي اقدم|ازاي انضم|طريقه الانضمام|طريقه التقديم|عاوز اقدم|عاوز انضم|ابقي عضو|فورم التقديم|فورم العضويه|رابط التقديم|لينك التقديم|بعد ما املا الفورم|بعد الفورم|how to join|how do i apply|how to apply|application form|join form|after i fill|after submitting)/.test(
        norm
      )
    ) {
      return isEn
        ? `To join as a Committee Member:\n1. Fill out the Member Application Form:\n${MEMBER_FORM_URL}\n2. An HR team member will contact you via WhatsApp to schedule your interview time and location.\n3. Pass the committee interview to join as a Member!`
        : `خطوات الانضمام لعضوية اللجان في ألكساندرز:\n1. املا فورم التقديم كـ عضو:\n${MEMBER_FORM_URL}\n2. هيتواصل معاك مسؤول من لجنة الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو.\n3. بعد اجتياز المقابلة، بتنضم للجنة بصفة Member!`;
    }

    // 9. Free Activities, Certificates & Transportation Allowances
    if (
      /(مجاني|مجانا|بفلوس|فلوس|رسوم|اشتراك|شهاده|شهادات|بدل انتقال|بدلات|are courses free|is it free|free of charge|cost|fees|certificate|allowance)/.test(
        norm
      )
    ) {
      return isEn
        ? "Yes! **100% of our activities, trainings, courses, workshops, sessions, and trips are completely free.** Most trainings include accredited certificates, and field visits often include transportation allowances."
        : "أيوه، **100% من الأنشطة، الكورسات، التدريبات، الورش، السيشنز، والرحلات مجانية بالكامل** بدون أي رسوم! وكمان معظم التدريبات بتقدم شهادات معتمدة، وكتير من الزيارات الميدانية بيكون فيها بدلات انتقال.";
    }

    // 10. Studies, Exams & Attendance Policy
    if (
      /(مذاكره|امتحان|امتحانات|حضور يومي|هياثر علي الدراسه|تعارض|affect my studies|study|exam|attendance)/.test(
        norm
      )
    ) {
      return isEn
        ? "Not at all! We don't require constant daily presence on campus, and we fully respect university schedules, exams, and personal circumstances as long as you communicate with your assigned HR Follower."
        : "أبداً، الانضمام مش بيأثر على المذاكرة أو الكلية! الحضور مش يومي، وفيه مرونة وتفهم كامل لمواعيد الجامعة والامتحانات والظروف الشخصية طالما فيه التزام بالمهام وتواصل مع الـ **HR Follower** الخاص بك.";
    }

    // 11. About Alexanders Group (What is Alexanders)
    if (
      /(ايه هو كيان|ايه هي جماعه|مين انتم|عن الكيان|عن الكساندرز|هدف الكيان|رؤيه الكيان|what is alexanders|about alexanders|alexanders group)/.test(
        norm
      )
    ) {
      return isEn
        ? `**Alexanders Group** ("Together for a Sustainable Alexandria") is an official student entity under the General Administration of Youth Welfare (Student Families Department) at Alexandria University. More than just organizing events, our core mission is spreading **Sustainable Development** into real initiatives and bridging the gap between university life and the job market through free courses, workshops, events, and trips.`
        : `**جماعة أليكساندرز (Alexanders Group)** تحت شعار "معاً من أجل إسكندرية مستدامة" هو كيان طلابي رسمي تابع للإدارة العامة لرعاية الشباب (إدارة الأسر الطلابية) بجامعة الإسكندرية.\nألكساندرز مش مجرد نشاط طلابي بينظم إيفنتات عشوائية، هويته الأساسية هي نشر مفهوم **التنمية المستدامة** وتحويله لمبادرات ومشاريع عملية وأثر مجتمعي حقيقي، مع سد الفجوة بين الدراسة وسوق العمل بتدريبات وأنشطة مجانية 100%.`;
    }

    // 12. Official Social Media Links & Video
    if (
      /(سوشيال ميديا|صفحات|فيسبوك|انستجرام|تيك توك|لينكد ان|يوتيوب|فيديو تعريفي|social media|facebook|instagram|tiktok|linkedin|youtube|contact|intro video)/.test(
        norm
      )
    ) {
      return isEn
        ? `Official Alexanders Group channels:\n- Facebook: ${FB_URL}\n- Instagram: ${IG_URL}\n- LinkedIn: ${LINKEDIN_URL}\n- TikTok: ${TIKTOK_URL}\n- YouTube: ${YOUTUBE_URL}\n- Intro Video: ${INTRO_VIDEO_URL}`
        : `الصفحات الرسمية لكيان ألكساندرز:\n- فيسبوك: ${FB_URL}\n- إنستجرام: ${IG_URL}\n- لينكد إن: ${LINKEDIN_URL}\n- تيك توك: ${TIKTOK_URL}\n- يوتيوب: ${YOUTUBE_URL}\n- الفيديو التعريفي: ${INTRO_VIDEO_URL}`;
    }

    return null;
  }

  async function sendMessage(rawText) {
    const userText = (rawText || "").trim();
    if (!userText || isBusy) return;

    // Instant, zero-auth FAQ reply when matched
    const faqReply = matchFaqReply(userText);
    if (faqReply) {
      hideAuthPrompt();
      pendingMessage = null;
      appendMessage("user", userText);
      if (dom.input) dom.input.value = "";
      appendMessage("assistant", faqReply);

      conversationHistory.push({ role: "user", content: userText });
      conversationHistory.push({ role: "assistant", content: faqReply });
      if (conversationHistory.length > MAX_HISTORY_MESSAGES) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY_MESSAGES);
      }

      if (dom.input) dom.input.focus();
      scrollToBottom();
      return;
    }

    if (!isPuterAvailable()) {
      appendMessage(
        "assistant",
        "تعذر تحميل خدمة المحادثة (Puter.js). تأكد من اتصالك بالإنترنت أو تعطيل مانع الإعلانات مؤقتاً ثم أعد تحميل الصفحة.",
        { isError: true }
      );
      return;
    }

    // User-Pays gate: check auth before calling Puter AI
    if (!isUserSignedIn()) {
      pendingMessage = userText;
      showAuthPrompt();
      return;
    }

    hideAuthPrompt();
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
            : `حدث خطأ أثناء الاتصال بالمساعد الذكي. يمكنك المحاولة مرة أخرى أو التواصل معنا على فيسبوك ${FB_URL}`;
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
            الأسئلة الشائعة متاحة بدون تسجيل دخول! للأسئلة المفتوحة والمحادثة الذكية الكاملة، سجّل الدخول مجاناً بضغطة واحدة (بحساب Google أو Puter).
          </p>
          <p class="alex-chat-auth-subdesc">FAQs work without sign-in. Open-ended AI answers need a free 1-click Google or Puter sign-in.</p>
          <p id="alexChatAuthError" class="alex-chat-auth-error" hidden></p>
          <div class="alex-chat-auth-actions">
            <button type="button" id="alexChatSignInBtn" class="alex-chat-signin-btn">
              متابعة بحساب Google / Puter
            </button>
            <button type="button" id="alexChatAuthDismiss" class="alex-chat-auth-dismiss">إلغاء</button>
          </div>
        </div>

        <div id="alexChatChips" class="alex-chat-chips" aria-label="أسئلة سريعة"></div>

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
    dom.chips = document.getElementById("alexChatChips");
    dom.form = document.getElementById("alexChatForm");
    dom.input = document.getElementById("alexChatInput");
    dom.sendBtn = document.getElementById("alexChatSendBtn");

    // Populate quick-starter chips
    QUICK_CHIPS.forEach((question) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "alex-chat-chip";
      chip.textContent = question;
      chip.addEventListener("click", () => {
        if (isBusy) return;
        sendMessage(question);
      });
      dom.chips.appendChild(chip);
    });

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
    dom.authPill?.addEventListener("click", handleSignInClick);
    dom.signInBtn?.addEventListener("click", handleSignInClick);
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
