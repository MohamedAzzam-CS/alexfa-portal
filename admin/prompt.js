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
};

async function checkPromptSession() {
  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt/session`, {
      method: "GET",
      credentials: "include",
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
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstructions: el.instructionsInput.value,
        knowledgeBase: el.kbInput.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      el.promptApp.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    el.metaInfo.textContent = `آخر تحديث مباشر: ${data.updatedAt} بواسطة ${data.updatedBy} (CMS_KV)`;
    el.saveResult.textContent = "✅ تم حفظ وتفعيل البرومبت الجديد مباشرة على الخادم بدون Pull Request!";
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

async function enterPromptApp() {
  el.loginOverlay.hidden = true;
  el.promptApp.hidden = false;
  await loadCurrentPrompt();
}

async function boot() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.saveBtn.addEventListener("click", handleSavePrompt);
  el.reloadBtn.addEventListener("click", loadCurrentPrompt);
  el.logoutBtn.addEventListener("click", handleLogout);

  const ok = await checkPromptSession();
  if (ok) {
    await enterPromptApp();
  } else {
    el.loginOverlay.hidden = false;
    el.promptApp.hidden = true;
  }
}

boot();
