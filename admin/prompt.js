// ============================================================================
// Alexanders AI Prompt Admin — Standalone Direct Backend Controller (No PR)
// Completely separated from the UI Visual Studio (admin/studio.html).
// Uses CMS_PROMPT_ADMIN_PASSWORD & /api/cms/prompt/* endpoints only.
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
  metaInfo: document.getElementById("promptMetaInfo"),
  instructionsInput: document.getElementById("promptInstructionsInput"),
  kbInput: document.getElementById("promptKbInput"),
  saveError: document.getElementById("promptSaveError"),
  saveResult: document.getElementById("promptSaveResult"),
  reloadBtn: document.getElementById("reloadPromptBtn"),
  saveBtn: document.getElementById("savePromptBtn"),
  logoutBtn: document.getElementById("promptLogoutBtn"),
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
let currentFaqs = [];

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
      clearPromptToken();
      el.promptApp.hidden = true;
      el.loginOverlay.hidden = false;
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
  } catch (err) {
    el.saveError.textContent = err?.message || "تعذر تحميل البرومبت الحالي.";
    el.saveError.hidden = false;
  }
}

async function handleSavePrompt() {
  el.saveError.hidden = true;
  el.saveResult.hidden = true;
  el.saveBtn.disabled = true;
  el.saveBtn.textContent = "جاري الحفظ...";

  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt`, {
      method: "POST",
      credentials: "include",
      headers: getPromptAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        systemInstructions: el.instructionsInput.value,
        knowledgeBase: el.kbInput.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearPromptToken();
      el.promptApp.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    el.metaInfo.textContent = `آخر تحديث مباشر: ${data.updatedAt} بواسطة ${data.updatedBy} (CMS_KV)`;
    el.saveResult.textContent =
      "✅ تم حفظ وتفعيل البرومبت الجديد مباشرة على الخادم (بدون PR)، وجاري تحديث إجابات الـ 21 سؤال شائع تلقائياً بالذكاء الاصطناعي!";
    el.saveResult.hidden = false;
  } catch (err) {
    el.saveError.textContent = err?.message || "فشل حفظ البرومبت.";
    el.saveError.hidden = false;
  } finally {
    el.saveBtn.disabled = false;
    el.saveBtn.textContent = "💾 حفظ وتفعيل مباشر (بدون PR)";
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
      clearPromptToken();
      el.promptApp.hidden = true;
      el.loginOverlay.hidden = false;
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
      clearPromptToken();
      el.promptApp.hidden = true;
      el.loginOverlay.hidden = false;
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

async function enterPromptApp() {
  el.loginOverlay.hidden = true;
  el.promptApp.hidden = false;
  await Promise.all([loadCurrentPrompt(), loadCurrentFaqs()]);
}

async function boot() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.saveBtn.addEventListener("click", handleSavePrompt);
  el.reloadBtn.addEventListener("click", loadCurrentPrompt);
  el.logoutBtn.addEventListener("click", handleLogout);

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
