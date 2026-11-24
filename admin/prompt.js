// ============================================================================
// Alexanders AI Prompt Admin — AI Prompt Assistant + Manual Fine-Tuning + FAQ
// - Primary top section: Non-technical AI Prompt Assistant (non-breaking edits,
//   conflict detection & friendly resolution before pushing, 1 change/min limit).
// - Secondary section: Manual Fine-Tuning with post-edit AI conflict review.
// - Tertiary section: FAQ Editor with AI cleanup pass & GitHub Actions sync.
// - iOS/Apple OS safe: uses sessionStorage Bearer token fallback alongside cookies.
// ============================================================================

const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
const API_BASE =
  typeof window !== "undefined" && typeof window.ALEXANDERS_CMS_API_BASE === "string"
    ? window.ALEXANDERS_CMS_API_BASE
    : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
      ? ""
      : DEFAULT_WORKER_ORIGIN;

const el = {
  loginOverlay: document.getElementById("promptLoginOverlay"),
  loginForm: document.getElementById("promptLoginForm"),
  loginError: document.getElementById("promptLoginError"),
  loginSubmitBtn: document.getElementById("promptLoginSubmitBtn"),
  adminNameInput: document.getElementById("promptAdminName"),
  adminPasswordInput: document.getElementById("promptAdminPassword"),
  promptApp: document.getElementById("promptApp"),
  logoutBtn: document.getElementById("promptLogoutBtn"),

  // Primary AI Prompt Agent Chat
  cooldownBadge: document.getElementById("promptCooldownBadge"),
  agentClearBtn: document.getElementById("agentClearBtn"),
  agentMessages: document.getElementById("agentMessages"),
  agentQuickChips: document.getElementById("agentQuickChips"),
  agentChatForm: document.getElementById("agentChatForm"),
  agentChatInput: document.getElementById("agentChatInput"),
  agentSendBtn: document.getElementById("agentSendBtn"),

  // Manual Fine-Tuning & AI Conflict Review
  manualDetails: document.getElementById("manualTuningDetails"),
  metaInfo: document.getElementById("promptMetaInfo"),
  instructionsInput: document.getElementById("promptInstructionsInput"),
  kbInput: document.getElementById("promptKbInput"),
  manualReviewWarning: document.getElementById("manualReviewWarning"),
  manualReviewSummary: document.getElementById("manualReviewSummary"),
  manualReviewConflicts: document.getElementById("manualReviewConflicts"),
  resolveWithAgentBtn: document.getElementById("resolveWithAgentBtn"),
  forceSavePromptBtn: document.getElementById("forceSavePromptBtn"),
  saveError: document.getElementById("promptSaveError"),
  saveResult: document.getElementById("promptSaveResult"),
  reloadBtn: document.getElementById("reloadPromptBtn"),
  saveBtn: document.getElementById("savePromptBtn"),

  // FAQ section refs
  faqMetaInfo: document.getElementById("faqMetaInfo"),
  faqItemsList: document.getElementById("faqItemsList"),
  addFaqBtn: document.getElementById("addFaqBtn"),
  reloadFaqsBtn: document.getElementById("reloadFaqsBtn"),
  saveFaqsBtn: document.getElementById("saveFaqsBtn"),
  faqSaveError: document.getElementById("faqSaveError"),
  faqSaveResult: document.getElementById("faqSaveResult"),
};

const PROMPT_TOKEN_KEY = "alex_cms_prompt_token";
const AGENT_WELCOME_MESSAGE =
  "أهلاً بك! 👋 أنا مساعدك الذكي لإدارة معلومات وتعليمات بوت ألكساندرز.\n" +
  "اكتب لي أي معلومة جديدة أو تعديل عايز تعمله بكلام عادي (بالعربي أو الإنجليزي)، وأنا هحدّث البرومبت بأمان بدون ما أأثر على باقي المعلومات.\n" +
  "لو في أي تعارض مع معلومات موجودة، هسألك الأول بطريقة بسيطة قبل ما أفعّل التعديل.\n" +
  "*(ملاحظة: مسموح بتفعيل تعديل واحد على البرومبت كل دقيقة للحفاظ على استقرار البوت).*";

let currentFaqs = [];
let agentHistory = [];
let agentBusy = false;
let lastManualConflicts = [];
let cooldownRemaining = 0;
let cooldownInterval = null;

function getPromptAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const tok = sessionStorage.getItem(PROMPT_TOKEN_KEY);
    if (tok) headers.Authorization = `Bearer ${tok}`;
  } catch {
    // ignore
  }
  return headers;
}

function clearPromptToken() {
  try {
    sessionStorage.removeItem(PROMPT_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function handleUnauthorized() {
  clearPromptToken();
  el.promptApp.hidden = true;
  el.loginOverlay.hidden = false;
}

// ============================================================================
// 1. Live 1-Change-Per-Minute Cooldown Badge
// ============================================================================
function updateCooldownBadge() {
  if (!el.cooldownBadge) return;
  if (cooldownRemaining > 0) {
    el.cooldownBadge.classList.add("is-cooling");
    el.cooldownBadge.textContent = `⏳ التعديل القادم بعد ${cooldownRemaining} ثانية`;
  } else {
    el.cooldownBadge.classList.remove("is-cooling");
    el.cooldownBadge.textContent = "جاهز للتحديث ✅";
  }
}

function startCooldownTimer(seconds) {
  const secs = Math.max(0, Math.ceil(Number(seconds) || 0));
  cooldownRemaining = secs;
  if (cooldownInterval) {
    clearInterval(cooldownInterval);
    cooldownInterval = null;
  }
  updateCooldownBadge();
  if (cooldownRemaining <= 0) return;

  cooldownInterval = setInterval(() => {
    cooldownRemaining = Math.max(0, cooldownRemaining - 1);
    updateCooldownBadge();
    if (cooldownRemaining <= 0 && cooldownInterval) {
      clearInterval(cooldownInterval);
      cooldownInterval = null;
    }
  }, 1000);
}

// ============================================================================
// 2. Auth Handlers
// ============================================================================
async function checkPromptSession() {
  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt/session`, {
      method: "GET",
      credentials: "include",
      headers: getPromptAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    return Boolean(res.ok && data?.authenticated);
  } catch {
    return false;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  el.loginError.hidden = true;
  el.loginSubmitBtn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        adminName: el.adminNameInput.value.trim() || "Prompt Admin",
        password: el.adminPasswordInput.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.authenticated) {
      el.loginError.textContent = data?.message || "كلمة مرور مدير البرومبت غير صحيحة.";
      el.loginError.hidden = false;
      return;
    }

    if (data.token) {
      try {
        sessionStorage.setItem(PROMPT_TOKEN_KEY, data.token);
      } catch {
        // ignore
      }
    }

    el.adminPasswordInput.value = "";
    await enterPromptApp();
  } catch {
    el.loginError.textContent = "تعذر الاتصال بخادم Cloudflare Worker.";
    el.loginError.hidden = false;
  } finally {
    el.loginSubmitBtn.disabled = false;
  }
}

async function handleLogout() {
  clearPromptToken();
  try {
    await fetch(`${API_BASE}/api/cms/prompt/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  el.promptApp.hidden = true;
  el.loginOverlay.hidden = false;
}

// ============================================================================
// 3. Primary Top Section: AI Prompt Assistant Chatbot
// ============================================================================
function appendAgentMessage(role, text, options = {}) {
  if (!el.agentMessages) return null;

  const bubble = document.createElement("div");
  bubble.className = `agent-msg agent-msg--${role}`;
  if (options.variant === "applied") bubble.classList.add("agent-msg--applied");
  if (options.variant === "conflict") bubble.classList.add("agent-msg--conflict");
  if (options.variant === "error") bubble.classList.add("agent-msg--error");

  const textNode = document.createElement("div");
  textNode.textContent = text;
  bubble.appendChild(textNode);

  if (Array.isArray(options.conflicts) && options.conflicts.length > 0) {
    const list = document.createElement("div");
    list.className = "agent-conflict-list";
    options.conflicts.forEach((c, idx) => {
      const card = document.createElement("div");
      card.className = "agent-conflict-item";

      const title = document.createElement("strong");
      title.textContent = `${idx + 1}. ${c.title || "تعارض محتمل"}`;
      card.appendChild(title);

      if (c.existingInfo) {
        const ex = document.createElement("div");
        ex.textContent = `• الموجود حالياً: ${c.existingInfo}`;
        card.appendChild(ex);
      }
      if (c.requestedChange) {
        const req = document.createElement("div");
        req.textContent = `• طلبك الجديد: ${c.requestedChange}`;
        card.appendChild(req);
      }
      if (c.question) {
        const q = document.createElement("span");
        q.className = "conflict-q";
        q.textContent = `❓ ${c.question}`;
        card.appendChild(q);
      }
      list.appendChild(card);
    });
    bubble.appendChild(list);
  }

  if (options.variant === "applied") {
    const badge = document.createElement("span");
    badge.className = "agent-applied-badge";
    badge.textContent = "✅ تم التفعيل المباشر وجاري تحديث الأسئلة الشائعة تلقائياً";
    bubble.appendChild(badge);
  }

  el.agentMessages.appendChild(bubble);
  el.agentMessages.scrollTop = el.agentMessages.scrollHeight;
  return bubble;
}

function resetAgentChat() {
  agentHistory = [];
  if (el.agentMessages) {
    el.agentMessages.innerHTML = "";
  }
  appendAgentMessage("assistant", AGENT_WELCOME_MESSAGE);
}

function setAgentBusy(busy) {
  agentBusy = busy;
  if (el.agentChatInput) el.agentChatInput.disabled = busy;
  if (el.agentSendBtn) {
    el.agentSendBtn.disabled = busy;
    el.agentSendBtn.textContent = busy ? "جاري المراجعة..." : "إرسال";
  }
}

async function sendAgentMessage(rawText) {
  const userText = String(rawText || "").trim();
  if (!userText || agentBusy) return;

  appendAgentMessage("user", userText);
  if (el.agentChatInput) el.agentChatInput.value = "";
  setAgentBusy(true);

  const thinkingNode = appendAgentMessage("assistant", "جاري مراجعة البرومبت الحالي والتأكد من عدم وجود تعارضات...");

  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt/chat`, {
      method: "POST",
      credentials: "include",
      headers: getPromptAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: userText,
        history: agentHistory.slice(-10),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (thinkingNode) thinkingNode.remove();

    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.status === 429 && data?.error === "RATE_LIMITED") {
      startCooldownTimer(data.retryAfterSeconds || 60);
      const reply =
        data.reply ||
        `مسموح بتعديل واحد فقط كل دقيقة. انتظر ${data.retryAfterSeconds || 60} ثانية ثم أعد الإرسال.`;
      appendAgentMessage("assistant", reply, { variant: "conflict" });
      agentHistory.push({ role: "user", content: userText });
      agentHistory.push({ role: "assistant", content: reply });
      return;
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    const replyText = String(data.reply || "تمت معالجة طلبك.").trim();

    if (data.pushed && data.prompt) {
      appendAgentMessage("assistant", replyText, { variant: "applied" });
      // Sync manual fine-tuning fields below with the newly pushed prompt
      el.instructionsInput.value = data.prompt.systemInstructions || "";
      el.kbInput.value = data.prompt.knowledgeBase || "";
      el.metaInfo.textContent = `آخر تحديث مباشر: ${data.prompt.updatedAt} بواسطة ${data.prompt.updatedBy} (CMS_KV)`;
      el.manualReviewWarning.hidden = true;
      startCooldownTimer(data.cooldownSeconds || 60);
    } else if (data.decision === "conflicts" || (Array.isArray(data.conflicts) && data.conflicts.length > 0)) {
      appendAgentMessage("assistant", replyText, {
        variant: "conflict",
        conflicts: data.conflicts || [],
      });
    } else {
      appendAgentMessage("assistant", replyText);
      if (typeof data.cooldownRemainingSeconds === "number" && data.cooldownRemainingSeconds > 0) {
        startCooldownTimer(data.cooldownRemainingSeconds);
      }
    }

    agentHistory.push({ role: "user", content: userText });
    agentHistory.push({ role: "assistant", content: replyText });
    if (agentHistory.length > 16) {
      agentHistory = agentHistory.slice(-16);
    }
  } catch (err) {
    if (thinkingNode) thinkingNode.remove();
    appendAgentMessage(
      "assistant",
      `حدث خطأ أثناء التواصل مع المساعد الذكي: ${err?.message || "حاول مرة أخرى."}`,
      { variant: "error" }
    );
  } finally {
    setAgentBusy(false);
  }
}

// ============================================================================
// 4. Secondary Section: Manual Fine-Tuning + Post-Edit AI Conflict Review
// ============================================================================
async function loadCurrentPrompt() {
  el.saveError.hidden = true;
  el.saveResult.hidden = true;
  el.manualReviewWarning.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt`, {
      method: "GET",
      credentials: "include",
      headers: getPromptAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    el.instructionsInput.value = data.systemInstructions || "";
    el.kbInput.value = data.knowledgeBase || "";
    el.metaInfo.textContent = data.updatedAt
      ? `آخر تحديث مباشر: ${data.updatedAt} بواسطة ${data.updatedBy || "Prompt Admin"} (${data.source})`
      : "يستخدم حالياً الإعداد الافتراضي من الخادم (default).";

    if (typeof data.cooldownRemainingSeconds === "number") {
      startCooldownTimer(data.cooldownRemainingSeconds);
    }
  } catch (err) {
    el.saveError.textContent = err?.message || "تعذر تحميل البرومبت الحالي.";
    el.saveError.hidden = false;
  }
}

function renderManualConflicts(summary, conflicts) {
  lastManualConflicts = Array.isArray(conflicts) ? conflicts : [];
  el.manualReviewSummary.textContent =
    summary || "تم رصد ملاحظات أو تعارضات محتملة في التعديل اليدوي.";
  el.manualReviewConflicts.innerHTML = "";

  lastManualConflicts.forEach((c, idx) => {
    const item = document.createElement("div");
    item.className = "agent-conflict-item";

    const title = document.createElement("strong");
    title.textContent = `${idx + 1}. ${c.title || "ملاحظة"}`;
    item.appendChild(title);

    if (c.detail) {
      const d = document.createElement("div");
      d.textContent = c.detail;
      item.appendChild(d);
    }
    if (c.suggestion) {
      const s = document.createElement("span");
      s.className = "conflict-q";
      s.textContent = `💡 اقتراح: ${c.suggestion}`;
      item.appendChild(s);
    }
    el.manualReviewConflicts.appendChild(item);
  });

  el.manualReviewWarning.hidden = false;
}

async function handleSavePrompt(forcePush = false) {
  el.saveError.hidden = true;
  el.saveResult.hidden = true;
  if (forcePush) {
    el.manualReviewWarning.hidden = true;
  }
  el.saveBtn.disabled = true;
  if (el.forceSavePromptBtn) el.forceSavePromptBtn.disabled = true;
  el.saveBtn.textContent = forcePush
    ? "جاري الحفظ والتفعيل..."
    : "🔍 جاري مراجعة التعارضات بالـ AI...";

  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt`, {
      method: "POST",
      credentials: "include",
      headers: getPromptAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        systemInstructions: el.instructionsInput.value,
        knowledgeBase: el.kbInput.value,
        forcePush: Boolean(forcePush),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }

    if (res.status === 429 && data?.error === "RATE_LIMITED") {
      startCooldownTimer(data.retryAfterSeconds || 60);
      throw new Error(
        data.message || `يمكن إجراء تعديل واحد فقط كل دقيقة. انتظر ${data.retryAfterSeconds || 60} ثانية.`
      );
    }

    // AI review detected potential conflicts before pushing
    if (data?.reviewBlocked && data?.status === "conflicts_found") {
      renderManualConflicts(data.summary, data.conflicts);
      return;
    }

    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    el.manualReviewWarning.hidden = true;
    startCooldownTimer(data.cooldownSeconds || 60);
    el.metaInfo.textContent = `آخر تحديث مباشر: ${data.updatedAt} بواسطة ${data.updatedBy} (CMS_KV)`;
    const reviewNote = data.reviewSummary ? ` (${data.reviewSummary})` : "";
    el.saveResult.textContent =
      `✅ تم حفظ وتفعيل البرومبت الجديد مباشرة على الخادم${reviewNote}، وجاري تحديث إجابات الأسئلة الشائعة تلقائياً بالذكاء الاصطناعي!`;
    el.saveResult.hidden = false;
  } catch (err) {
    el.saveError.textContent = err?.message || "فشل حفظ البرومبت.";
    el.saveError.hidden = false;
  } finally {
    el.saveBtn.disabled = false;
    if (el.forceSavePromptBtn) el.forceSavePromptBtn.disabled = false;
    el.saveBtn.textContent = "🔍 مراجعة بالـ AI وحفظ التعديل اليدوي";
  }
}

// ============================================================================
// 5. Tertiary Section: FAQ Editor
// ============================================================================
function renderFaqEditorList() {
  if (!el.faqItemsList) return;
  el.faqItemsList.innerHTML = "";

  currentFaqs.forEach((item, idx) => {
    const card = document.createElement("div");
    card.style.cssText =
      "background:rgba(255,255,255,0.03);border:1px solid var(--studio-border);border-radius:12px;padding:14px;";

    const topRow = document.createElement("div");
    topRow.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

    const badge = document.createElement("strong");
    badge.style.cssText = "font-size:0.84rem;color:var(--studio-accent);";
    badge.textContent = `سؤال #${idx + 1} (${item.faqRef || `faq-${idx + 1}`})`;

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "studio-btn studio-btn--danger";
    delBtn.style.padding = "4px 10px";
    delBtn.textContent = "حذف";
    delBtn.addEventListener("click", () => {
      currentFaqs.splice(idx, 1);
      renderFaqEditorList();
    });

    topRow.appendChild(badge);
    topRow.appendChild(delBtn);

    const qInput = document.createElement("input");
    qInput.type = "text";
    qInput.className = "studio-input";
    qInput.dir = "auto";
    qInput.placeholder = "نص السؤال...";
    qInput.value = item.question || "";
    qInput.style.marginBottom = "8px";
    qInput.addEventListener("input", () => {
      currentFaqs[idx].question = qInput.value;
    });

    const aInput = document.createElement("textarea");
    aInput.className = "studio-textarea";
    aInput.dir = "auto";
    aInput.rows = 3;
    aInput.placeholder = "الإجابة (تدعم Markdown والروابط)...";
    aInput.value = item.answer || "";
    aInput.addEventListener("input", () => {
      currentFaqs[idx].answer = aInput.value;
    });

    card.appendChild(topRow);
    card.appendChild(qInput);
    card.appendChild(aInput);
    el.faqItemsList.appendChild(card);
  });
}

async function loadCurrentFaqs() {
  el.faqSaveError.hidden = true;
  el.faqSaveResult.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/api/cms/faqs`, {
      method: "GET",
      credentials: "include",
      headers: getPromptAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

    currentFaqs = Array.isArray(data.faqs) ? data.faqs.map((f) => ({ ...f })) : [];
    el.faqMetaInfo.textContent = data.updatedAt
      ? `عدد الأسئلة: ${currentFaqs.length} | آخر تحديث: ${data.updatedAt} (${data.source})`
      : `عدد الأسئلة: ${currentFaqs.length} (الإعداد الافتراضي)`;
    renderFaqEditorList();
  } catch (err) {
    el.faqSaveError.textContent = err?.message || "تعذر تحميل الأسئلة الشائعة.";
    el.faqSaveError.hidden = false;
  }
}

async function handleSaveFaqs() {
  el.faqSaveError.hidden = true;
  el.faqSaveResult.hidden = true;
  el.saveFaqsBtn.disabled = true;
  el.saveFaqsBtn.textContent = "✨ جاري المراجعة بالـ AI وتشغيل التحديث...";

  try {
    const res = await fetch(`${API_BASE}/api/cms/faqs`, {
      method: "POST",
      credentials: "include",
      headers: getPromptAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ faqs: currentFaqs }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleUnauthorized();
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    currentFaqs = Array.isArray(data.faqs) ? data.faqs : currentFaqs;
    renderFaqEditorList();

    const wfNote = data.workflowDispatched
      ? "وتم تشغيل GitHub Workflow تلقائياً لتحديث الواجهة الأمامية (chat-widget.js)!"
      : "تم الحفظ في الخادم بنجاح (تأكد من صلاحية Actions: Write في GITHUB_TOKEN لتشغيل الـ Workflow تلقائياً).";

    el.faqMetaInfo.textContent = `عدد الأسئلة: ${currentFaqs.length} | آخر تحديث: ${data.updatedAt} (تمت مراجعة ${data.aiCleanedCount} سؤال بالـ AI)`;
    el.faqSaveResult.textContent = `✅ تمت المراجعة والتنظيف بالذكاء الاصطناعي وحفظ ${currentFaqs.length} سؤال في الخادم، ${wfNote}`;
    el.faqSaveResult.hidden = false;
  } catch (err) {
    el.faqSaveError.textContent = err?.message || "فشل حفظ الأسئلة الشائعة.";
    el.faqSaveError.hidden = false;
  } finally {
    el.saveFaqsBtn.disabled = false;
    el.saveFaqsBtn.textContent = "✨ مراجعة بالـ AI وحفظ وتحديث الموقع";
  }
}

// ============================================================================
// 6. App Boot
// ============================================================================
async function enterPromptApp() {
  el.loginOverlay.hidden = true;
  el.promptApp.hidden = false;
  if (el.agentMessages && el.agentMessages.children.length === 0) {
    resetAgentChat();
  }
  await Promise.all([loadCurrentPrompt(), loadCurrentFaqs()]);
}

async function boot() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.logoutBtn.addEventListener("click", handleLogout);

  // AI Agent Chat wiring
  el.agentChatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendAgentMessage(el.agentChatInput?.value);
  });
  el.agentChatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendAgentMessage(el.agentChatInput.value);
    }
  });
  el.agentClearBtn?.addEventListener("click", resetAgentChat);
  el.agentQuickChips?.querySelectorAll(".agent-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const promptText = chip.dataset.prompt || chip.textContent;
      sendAgentMessage(promptText);
    });
  });

  // Manual Fine-Tuning wiring
  el.saveBtn.addEventListener("click", () => handleSavePrompt(false));
  el.forceSavePromptBtn?.addEventListener("click", () => handleSavePrompt(true));
  el.resolveWithAgentBtn?.addEventListener("click", () => {
    const summaryList = lastManualConflicts
      .map((c, i) => `${i + 1}) ${c.title}: ${c.detail}`)
      .join("\n");
    window.scrollTo({ top: 0, behavior: "smooth" });
    sendAgentMessage(
      `حاولت أعدل البرومبت يدوياً لكن المراجعة رصدت التعارضات دي، ساعدني أحلها بطريقة آمنة:\n${summaryList}`
    );
  });
  el.reloadBtn.addEventListener("click", loadCurrentPrompt);

  // FAQ wiring
  el.addFaqBtn.addEventListener("click", () => {
    currentFaqs.push({
      id: currentFaqs.length + 1,
      faqRef: `faq-${currentFaqs.length + 1}`,
      question: "",
      answer: "",
    });
    renderFaqEditorList();
  });
  el.reloadFaqsBtn.addEventListener("click", loadCurrentFaqs);
  el.saveFaqsBtn.addEventListener("click", handleSaveFaqs);

  const ok = await checkPromptSession();
  if (ok) {
    await enterPromptApp();
  } else {
    el.loginOverlay.hidden = false;
    el.promptApp.hidden = true;
  }
}

boot();
