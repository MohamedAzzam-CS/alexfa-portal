// ============================================================================
// Alexanders AI Prompt Chat — Client-Side Puter AI + Explicit Confirmation Preview
// 1. Admin signs into Puter AND enters Prompt Admin Password.
// 2. Backend serves current prompt + Egypt date + assistant instructions once.
// 3. Chat runs client-side via window.puter.ai.chat(...) — preservative, deduplicated,
//    Egypt-date aware, and NEVER pushes until admin explicitly clicks Confirm.
// ============================================================================

const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
const API_BASE =
  typeof window !== "undefined" && typeof window.ALEXANDERS_CMS_API_BASE === "string"
    ? window.ALEXANDERS_CMS_API_BASE
    : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
      ? ""
      : DEFAULT_WORKER_ORIGIN;

const PROMPT_TOKEN_KEY = "alex_cms_prompt_token";
const PROPOSAL_START = "<<<PROPOSAL_JSON>>>";
const PROPOSAL_END = "<<<END_PROPOSAL_JSON>>>";

const el = {
  // Login Gate
  loginOverlay: document.getElementById("promptLoginOverlay"),
  puterStepBox: document.getElementById("puterStepBox"),
  puterStepStatus: document.getElementById("puterStepStatus"),
  puterLoginBtn: document.getElementById("puterLoginBtn"),
  loginForm: document.getElementById("promptLoginForm"),
  loginError: document.getElementById("promptLoginError"),
  loginSubmitBtn: document.getElementById("promptLoginSubmitBtn"),
  adminNameInput: document.getElementById("promptAdminName"),
  adminPasswordInput: document.getElementById("promptAdminPassword"),

  // Main Chat App
  promptApp: document.getElementById("promptApp"),
  egyptDateHeader: document.getElementById("egyptDateHeader"),
  newChatBtn: document.getElementById("newChatBtn"),
  logoutBtn: document.getElementById("promptLogoutBtn"),
  chatMessages: document.getElementById("chatMessages"),
  chatQuickChips: document.getElementById("chatQuickChips"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  chatSendBtn: document.getElementById("chatSendBtn"),

  // Optional Manual Edit
  metaInfo: document.getElementById("promptMetaInfo"),
  instructionsInput: document.getElementById("promptInstructionsInput"),
  kbInput: document.getElementById("promptKbInput"),
  saveError: document.getElementById("promptSaveError"),
  saveResult: document.getElementById("promptSaveResult"),
  reloadBtn: document.getElementById("reloadPromptBtn"),
  saveBtn: document.getElementById("savePromptBtn"),

  // Optional FAQ Editor
  faqMetaInfo: document.getElementById("faqMetaInfo"),
  faqItemsList: document.getElementById("faqItemsList"),
  addFaqBtn: document.getElementById("addFaqBtn"),
  reloadFaqsBtn: document.getElementById("reloadFaqsBtn"),
  saveFaqsBtn: document.getElementById("saveFaqsBtn"),
  faqSaveError: document.getElementById("faqSaveError"),
  faqSaveResult: document.getElementById("faqSaveResult"),
};

let assistantSystemPrompt = "";
let currentPromptState = { systemInstructions: "", knowledgeBase: "" };
let chatHistory = [];
let chatBusy = false;
let currentFaqs = [];

// ============================================================================
// 1. Auth Helpers (Puter + iOS-safe sessionStorage Bearer Token)
// ============================================================================
function isPuterAvailable() {
  return Boolean(typeof window !== "undefined" && window.puter && window.puter.auth);
}

function isPuterSignedIn() {
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
  refreshPuterLoginStatus();
}

function refreshPuterLoginStatus() {
  if (!el.puterStepBox || !el.puterStepStatus || !el.puterLoginBtn) return;
  if (isPuterSignedIn()) {
    el.puterStepBox.classList.add("is-connected");
    el.puterStepStatus.textContent = "1. ✅ متصل بحساب Puter";
    el.puterLoginBtn.textContent = "متصل";
    el.puterLoginBtn.disabled = true;
  } else {
    el.puterStepBox.classList.remove("is-connected");
    el.puterStepStatus.textContent = "1. تسجيل الدخول بحساب Puter (مطلوب لتشغيل الشات)";
    el.puterLoginBtn.textContent = "تسجيل الدخول عبر Puter";
    el.puterLoginBtn.disabled = false;
  }
}

function triggerPuterLogin() {
  el.loginError.hidden = true;
  if (!isPuterAvailable()) {
    el.loginError.textContent = "تعذر تحميل Puter.js. تأكد من اتصالك بالإنترنت ثم أعد تحميل الصفحة.";
    el.loginError.hidden = false;
    return;
  }

  el.puterLoginBtn.disabled = true;
  el.puterLoginBtn.textContent = "جاري الاتصال...";

  // Called synchronously inside click handler for iOS Safari popup compatibility
  let p;
  try {
    p = window.puter.auth.signIn();
  } catch {
    el.loginError.textContent = "المتصفح منع نافذة Puter. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.";
    el.loginError.hidden = false;
    refreshPuterLoginStatus();
    return;
  }

  Promise.resolve(p)
    .then(() => {
      refreshPuterLoginStatus();
    })
    .catch(() => {
      el.loginError.textContent = "لم يكتمل تسجيل الدخول عبر Puter. حاول مرة أخرى.";
      el.loginError.hidden = false;
      refreshPuterLoginStatus();
    });
}

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

  if (!isPuterSignedIn()) {
    el.loginError.textContent = "يرجى إتمام الخطوة (1) وتسجيل الدخول عبر Puter أولاً.";
    el.loginError.hidden = false;
    return;
  }

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
  refreshPuterLoginStatus();
}

// ============================================================================
// 2. Backend Context & Prompt Persistence
// ============================================================================
async function loadCurrentPrompt() {
  el.saveError.hidden = true;
  el.saveResult.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt`, {
      method: "GET",
      credentials: "include",
      headers: getPromptAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      handleUnauthorized();
      return false;
    }
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

    currentPromptState = {
      systemInstructions: data.systemInstructions || "",
      knowledgeBase: data.knowledgeBase || "",
    };
    assistantSystemPrompt = data.assistantSystemPrompt || "";

    el.instructionsInput.value = currentPromptState.systemInstructions;
    el.kbInput.value = currentPromptState.knowledgeBase;
    el.metaInfo.textContent = data.updatedAt
      ? `آخر تحديث مباشر: ${data.updatedAt} بواسطة ${data.updatedBy || "Prompt Admin"} (${data.source})`
      : "يستخدم حالياً الإعداد الافتراضي من الخادم (default).";

    if (el.egyptDateHeader && data.egyptDate?.egyptDateArabic) {
      el.egyptDateHeader.textContent = `📅 بتوقيت مصر: ${data.egyptDate.egyptDateArabic} • التعديلات لا تُحفظ إلا بعد تأكيدك`;
    }
    return true;
  } catch (err) {
    el.saveError.textContent = err?.message || "تعذر تحميل البرومبت الحالي.";
    el.saveError.hidden = false;
    return false;
  }
}

async function pushPromptToServer({ systemInstructions, knowledgeBase }) {
  const res = await fetch(`${API_BASE}/api/cms/prompt`, {
    method: "POST",
    credentials: "include",
    headers: getPromptAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ systemInstructions, knowledgeBase }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مجدداً.");
  }
  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }
  // Reload fresh backend context + Egypt date after saving
  await loadCurrentPrompt();
  return data;
}

// ============================================================================
// 3. Client-Side Puter AI Chat + Final Prompt Preview & Confirmation
// ============================================================================
function extractPuterReplyText(res) {
  if (!res) return "";
  if (typeof res === "string") return res.trim();
  const content =
    res?.message?.content ??
    res?.choices?.[0]?.message?.content ??
    res?.text ??
    res?.result?.message?.content ??
    "";
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === "string" ? p : p?.text || ""))
      .join("")
      .trim();
  }
  return typeof content === "string" ? content.trim() : "";
}

function parseProposalFromReply(rawText) {
  const text = String(rawText || "");
  const startIdx = text.indexOf(PROPOSAL_START);
  const endIdx = text.indexOf(PROPOSAL_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { cleanText: text.trim(), proposal: null };
  }

  const visibleBefore = text.slice(0, startIdx).trim();
  const visibleAfter = text.slice(endIdx + PROPOSAL_END.length).trim();
  const cleanText = [visibleBefore, visibleAfter].filter(Boolean).join("\n\n").trim();

  const jsonChunk = text
    .slice(startIdx + PROPOSAL_START.length, endIdx)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonChunk);
    const sys =
      typeof parsed?.systemInstructions === "string" && parsed.systemInstructions.trim()
        ? parsed.systemInstructions.trim()
        : currentPromptState.systemInstructions;
    const kb =
      typeof parsed?.knowledgeBase === "string" && parsed.knowledgeBase.trim()
        ? parsed.knowledgeBase.trim()
        : currentPromptState.knowledgeBase;

    if (!sys || !kb) {
      return { cleanText: cleanText || text.trim(), proposal: null };
    }

    return {
      cleanText: cleanText || "جهّزت التعديل المقترح بالأسفل — راجعه واضغط تأكيد للتفعيل:",
      proposal: {
        summary: String(parsed?.summary || "تعديل مقترح على البرومبت وقاعدة المعرفة").trim(),
        systemInstructions: sys,
        knowledgeBase: kb,
      },
    };
  } catch {
    return { cleanText: cleanText || text.trim(), proposal: null };
  }
}

function renderProposalCard(proposal) {
  const card = document.createElement("div");
  card.className = "proposal-card";

  const title = document.createElement("h3");
  title.className = "proposal-title";
  title.textContent = "📋 معاينة البرومبت النهائي (بانتظار تأكيدك)";
  card.appendChild(title);

  const summary = document.createElement("p");
  summary.className = "proposal-summary";
  summary.textContent = proposal.summary;
  card.appendChild(summary);

  // Expandable preview of System Instructions
  const sysDetails = document.createElement("details");
  sysDetails.className = "proposal-preview-details";
  const sysSum = document.createElement("summary");
  sysSum.textContent = `معاينة تعليمات النظام (${proposal.systemInstructions.length} حرف)`;
  const sysBox = document.createElement("div");
  sysBox.className = "proposal-preview-box";
  sysBox.dir = "auto";
  sysBox.textContent = proposal.systemInstructions;
  sysDetails.appendChild(sysSum);
  sysDetails.appendChild(sysBox);
  card.appendChild(sysDetails);

  // Expandable preview of Knowledge Base
  const kbDetails = document.createElement("details");
  kbDetails.className = "proposal-preview-details";
  const kbSum = document.createElement("summary");
  kbSum.textContent = `معاينة قاعدة المعرفة النهائية (${proposal.knowledgeBase.length} حرف)`;
  const kbBox = document.createElement("div");
  kbBox.className = "proposal-preview-box";
  kbBox.dir = "auto";
  kbBox.textContent = proposal.knowledgeBase;
  kbDetails.appendChild(kbSum);
  kbDetails.appendChild(kbBox);
  card.appendChild(kbDetails);

  // Explicit review checkbox required before confirm button is enabled
  const checkLabel = document.createElement("label");
  checkLabel.className = "proposal-confirm-check";
  const checkInput = document.createElement("input");
  checkInput.type = "checkbox";
  const checkText = document.createElement("span");
  checkText.textContent =
    "راجعت المعاينة النهائية والتواريخ بتوقيت مصر وأؤكد رغبتي في تفعيل هذا التعديل مباشرة على المساعد الذكي.";
  checkLabel.appendChild(checkInput);
  checkLabel.appendChild(checkText);
  card.appendChild(checkLabel);

  const actions = document.createElement("div");
  actions.className = "proposal-actions";

  const confirmBtn = document.createElement("button");
  confirmBtn.type = "button";
  confirmBtn.className = "studio-btn studio-btn--primary";
  confirmBtn.textContent = "✅ تأكيد وتفعيل التعديل";
  confirmBtn.disabled = true;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "studio-btn";
  cancelBtn.textContent = "❌ إلغاء / تعديل";

  const statusLine = document.createElement("div");
  statusLine.className = "proposal-status";
  statusLine.hidden = true;

  let isArmed = false;
  let armTimer = null;

  const disarm = () => {
    isArmed = false;
    if (armTimer) {
      clearTimeout(armTimer);
      armTimer = null;
    }
    confirmBtn.classList.remove("is-armed");
    confirmBtn.textContent = "✅ تأكيد وتفعيل التعديل";
  };

  checkInput.addEventListener("change", () => {
    disarm();
    confirmBtn.disabled = !checkInput.checked;
  });

  confirmBtn.addEventListener("click", async () => {
    if (!checkInput.checked) return;

    // 2-step click confirmation so admin never publishes by accident
    if (!isArmed) {
      isArmed = true;
      confirmBtn.classList.add("is-armed");
      confirmBtn.textContent = "⚠️ اضغط مرة أخرى للتأكيد النهائي والنشر";
      armTimer = setTimeout(disarm, 8000);
      return;
    }

    disarm();
    checkInput.disabled = true;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = "جاري الحفظ والتفعيل...";
    try {
      await pushPromptToServer({
        systemInstructions: proposal.systemInstructions,
        knowledgeBase: proposal.knowledgeBase,
      });
      card.classList.add("is-confirmed");
      checkLabel.hidden = true;
      actions.hidden = true;
      statusLine.textContent = "✅ تم حفظ وتفعيل البرومبت الجديد مباشرة على الخادم!";
      statusLine.hidden = false;
    } catch (err) {
      checkInput.disabled = false;
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = "✅ تأكيد وتفعيل التعديل";
      statusLine.style.color = "#fca5a5";
      statusLine.textContent = `فشل الحفظ: ${err?.message || "حاول مرة أخرى"}`;
      statusLine.hidden = false;
    }
  });

  cancelBtn.addEventListener("click", () => {
    disarm();
    card.classList.add("is-cancelled");
    checkLabel.hidden = true;
    actions.hidden = true;
    statusLine.style.color = "var(--studio-muted)";
    statusLine.textContent = "تم الإلغاء — اكتب أي تعديل إضافي تريده في المحادثة.";
    statusLine.hidden = false;
  });

  actions.appendChild(confirmBtn);
  actions.appendChild(cancelBtn);
  card.appendChild(actions);
  card.appendChild(statusLine);
  return card;
}

function appendChatBubble(role, text, options = {}) {
  if (!el.chatMessages) return null;
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble chat-bubble--${role}`;
  if (options.isError) bubble.classList.add("chat-bubble--error");

  const body = document.createElement("div");
  body.textContent = text;
  bubble.appendChild(body);

  if (options.proposal) {
    bubble.appendChild(renderProposalCard(options.proposal));
  }

  el.chatMessages.appendChild(bubble);
  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  return bubble;
}

function resetChat() {
  chatHistory = [];
  if (el.chatMessages) el.chatMessages.innerHTML = "";
  appendChatBubble(
    "assistant",
    "أهلاً بك! 👋 أنا مساعدك لإدارة برومبت ألكساندرز.\n" +
      "اكتب لي أي تعديل أو إضافة (والتواريخ دايماً هتتظبط بتوقيت مصر)، وأنا هحافظ على باقي المعلومات وأحذف أي تكرار، ومش هحفظ أي حاجة غير بعد ما تشوف المعاينة النهائية وتضغط تأكيد."
  );
}

function setChatBusy(busy) {
  chatBusy = busy;
  if (el.chatInput) el.chatInput.disabled = busy;
  if (el.chatSendBtn) {
    el.chatSendBtn.disabled = busy;
    el.chatSendBtn.textContent = busy ? "جاري التفكير..." : "إرسال";
  }
}

async function sendChatMessage(rawText) {
  const userText = String(rawText || "").trim();
  if (!userText || chatBusy) return;

  if (!window.puter?.ai?.chat || !isPuterSignedIn()) {
    appendChatBubble(
      "assistant",
      "جلسة Puter غير متصلة. يرجى تسجيل الدخول بحساب Puter أولاً ثم إعادة المحاولة.",
      { isError: true }
    );
    return;
  }

  appendChatBubble("user", userText);
  if (el.chatInput) el.chatInput.value = "";
  setChatBusy(true);

  const thinkingNode = appendChatBubble("assistant", "جاري المراجعة وإعداد الرد...");

  try {
    if (!assistantSystemPrompt) {
      await loadCurrentPrompt();
    }

    const messages = [
      { role: "system", content: assistantSystemPrompt },
      ...chatHistory.slice(-10),
      { role: "user", content: userText },
    ];

    const puterRes = await window.puter.ai.chat(messages);
    const fullReply = extractPuterReplyText(puterRes);
    if (thinkingNode) thinkingNode.remove();

    if (!fullReply) {
      throw new Error("لم يتم استلام رد من Puter AI.");
    }

    const { cleanText, proposal } = parseProposalFromReply(fullReply);
    appendChatBubble("assistant", cleanText, { proposal });

    chatHistory.push({ role: "user", content: userText });
    chatHistory.push({ role: "assistant", content: cleanText });
    if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);
  } catch (err) {
    if (thinkingNode) thinkingNode.remove();
    appendChatBubble(
      "assistant",
      `حدث خطأ أثناء الاتصال بـ Puter AI: ${err?.message || "حاول مرة أخرى."}`,
      { isError: true }
    );
  } finally {
    setChatBusy(false);
    if (el.chatInput) el.chatInput.focus();
  }
}

// ============================================================================
// 4. Optional Manual Save & FAQ Editor
// ============================================================================
async function handleManualSavePrompt() {
  el.saveError.hidden = true;
  el.saveResult.hidden = true;
  el.saveBtn.disabled = true;
  el.saveBtn.textContent = "جاري الحفظ...";
  try {
    await pushPromptToServer({
      systemInstructions: el.instructionsInput.value,
      knowledgeBase: el.kbInput.value,
    });
    el.saveResult.textContent = "✅ تم حفظ وتفعيل البرومبت الجديد مباشرة على الخادم، وجاري تحديث الأسئلة الشائعة تلقائياً.";
    el.saveResult.hidden = false;
  } catch (err) {
    el.saveError.textContent = err?.message || "فشل حفظ البرومبت.";
    el.saveError.hidden = false;
  } finally {
    el.saveBtn.disabled = false;
    el.saveBtn.textContent = "💾 حفظ مباشر";
  }
}

function renderFaqEditorList() {
  if (!el.faqItemsList) return;
  el.faqItemsList.innerHTML = "";
  currentFaqs.forEach((item, idx) => {
    const card = document.createElement("div");
    card.style.cssText =
      "background:rgba(255,255,255,0.03);border:1px solid var(--studio-border);border-radius:12px;padding:12px;";

    const topRow = document.createElement("div");
    topRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;";

    const badge = document.createElement("strong");
    badge.style.cssText = "font-size:0.84rem;color:var(--studio-accent);";
    badge.textContent = `سؤال #${idx + 1}`;

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
    qInput.value = item.question || "";
    qInput.style.marginBottom = "8px";
    qInput.addEventListener("input", () => {
      currentFaqs[idx].question = qInput.value;
    });

    const aInput = document.createElement("textarea");
    aInput.className = "studio-textarea";
    aInput.dir = "auto";
    aInput.rows = 3;
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
    el.faqMetaInfo.textContent = `عدد الأسئلة: ${currentFaqs.length}`;
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
  el.saveFaqsBtn.textContent = "✨ جاري المراجعة والحفظ...";
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
    if (!res.ok || !data?.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    currentFaqs = Array.isArray(data.faqs) ? data.faqs : currentFaqs;
    renderFaqEditorList();
    el.faqSaveResult.textContent = `✅ تم حفظ ${currentFaqs.length} سؤال وتحديث الواجهة الأمامية.`;
    el.faqSaveResult.hidden = false;
  } catch (err) {
    el.faqSaveError.textContent = err?.message || "فشل حفظ الأسئلة.";
    el.faqSaveError.hidden = false;
  } finally {
    el.saveFaqsBtn.disabled = false;
    el.saveFaqsBtn.textContent = "✨ مراجعة بالـ AI وحفظ";
  }
}

// ============================================================================
// 5. Boot
// ============================================================================
async function enterPromptApp() {
  el.loginOverlay.hidden = true;
  el.promptApp.hidden = false;
  if (el.chatMessages && el.chatMessages.children.length === 0) {
    resetChat();
  }
  await Promise.all([loadCurrentPrompt(), loadCurrentFaqs()]);
}

async function boot() {
  el.puterLoginBtn?.addEventListener("click", triggerPuterLogin);
  el.loginForm?.addEventListener("submit", handleLogin);
  el.logoutBtn?.addEventListener("click", handleLogout);
  el.newChatBtn?.addEventListener("click", resetChat);

  el.chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    sendChatMessage(el.chatInput?.value);
  });
  el.chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(el.chatInput.value);
    }
  });

  el.saveBtn?.addEventListener("click", handleManualSavePrompt);
  el.reloadBtn?.addEventListener("click", loadCurrentPrompt);
  el.addFaqBtn?.addEventListener("click", () => {
    currentFaqs.push({
      id: currentFaqs.length + 1,
      faqRef: `faq-${currentFaqs.length + 1}`,
      question: "",
      answer: "",
    });
    renderFaqEditorList();
  });
  el.reloadFaqsBtn?.addEventListener("click", loadCurrentFaqs);
  el.saveFaqsBtn?.addEventListener("click", handleSaveFaqs);

  refreshPuterLoginStatus();

  const ok = await checkPromptSession();
  if (ok && isPuterSignedIn()) {
    await enterPromptApp();
  } else {
    el.loginOverlay.hidden = false;
    el.promptApp.hidden = true;
  }
}

boot();
