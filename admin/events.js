// ============================================================================
// Alexanders Events Admin Dashboard (Zero AI Helper — Direct KV CRUD)
// - All dates/times strictly in Egypt local time (Africa/Cairo)
// - Image upload with automatic client-side compression + placeholder fallback
// - iOS/Apple OS safe: uses sessionStorage Bearer token alongside cookies
// ============================================================================

const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
const API_BASE =
  typeof window !== "undefined" && typeof window.ALEXANDERS_CMS_API_BASE === "string"
    ? window.ALEXANDERS_CMS_API_BASE
    : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
      ? ""
      : DEFAULT_WORKER_ORIGIN;

const TOKEN_KEY = "alex_cms_prompt_token";
const DEFAULT_PLACEHOLDER_STORED = "assets/event-placeholder.svg";
const DEFAULT_PLACEHOLDER_ADMIN_PREVIEW = "../assets/event-placeholder.svg";

const el = {
  loginOverlay: document.getElementById("eventsLoginOverlay"),
  loginForm: document.getElementById("eventsLoginForm"),
  loginError: document.getElementById("eventsLoginError"),
  loginSubmitBtn: document.getElementById("eventsLoginSubmitBtn"),
  adminNameInput: document.getElementById("eventsAdminName"),
  adminPasswordInput: document.getElementById("eventsAdminPassword"),

  app: document.getElementById("eventsApp"),
  egyptNowMeta: document.getElementById("egyptNowMeta"),
  logoutBtn: document.getElementById("eventsLogoutBtn"),

  formTitle: document.getElementById("eventFormTitle"),
  form: document.getElementById("eventForm"),
  idInput: document.getElementById("eventIdInput"),
  titleInput: document.getElementById("eventTitleInput"),
  categoryInput: document.getElementById("eventCategoryInput"),
  dateInput: document.getElementById("eventDateInput"),
  timeInput: document.getElementById("eventTimeInput"),
  locationInput: document.getElementById("eventLocationInput"),
  regUrlInput: document.getElementById("eventRegUrlInput"),
  descInput: document.getElementById("eventDescInput"),
  imagePreview: document.getElementById("eventImagePreview"),
  imageFileInput: document.getElementById("eventImageFileInput"),
  uploadImageBtn: document.getElementById("uploadImageBtn"),
  resetImageBtn: document.getElementById("resetImageBtn"),
  imageUrlInput: document.getElementById("eventImageUrlInput"),
  formError: document.getElementById("eventFormError"),
  formSuccess: document.getElementById("eventFormSuccess"),
  cancelEditBtn: document.getElementById("cancelEditBtn"),
  saveEventBtn: document.getElementById("saveEventBtn"),

  filterUpcomingBtn: document.getElementById("adminFilterUpcoming"),
  filterPassedBtn: document.getElementById("adminFilterPassed"),
  upcomingCount: document.getElementById("adminUpcomingCount"),
  passedCount: document.getElementById("adminPassedCount"),
  eventsContainer: document.getElementById("adminEventsContainer"),
};

let eventsState = { upcoming: [], passed: [], egyptNow: null };
let activeFilter = "upcoming";
let currentImageValue = DEFAULT_PLACEHOLDER_STORED;

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  try {
    const tok = sessionStorage.getItem(TOKEN_KEY);
    if (tok) headers.Authorization = `Bearer ${tok}`;
  } catch {
    // ignore
  }
  return headers;
}

function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

function resolveAdminPreviewSrc(imageVal) {
  if (!imageVal || imageVal === DEFAULT_PLACEHOLDER_STORED) {
    return DEFAULT_PLACEHOLDER_ADMIN_PREVIEW;
  }
  if (/^(?:data:|https?:\/\/|\.\.\/|\/)/i.test(imageVal)) {
    return imageVal;
  }
  return `../${imageVal}`;
}

function setPreviewImage(val) {
  currentImageValue = val && String(val).trim() ? String(val).trim() : DEFAULT_PLACEHOLDER_STORED;
  el.imagePreview.src = resolveAdminPreviewSrc(currentImageValue);
  el.imageUrlInput.value =
    currentImageValue === DEFAULT_PLACEHOLDER_STORED || currentImageValue.startsWith("data:")
      ? ""
      : currentImageValue;
}

function compressImageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة ملف الصورة."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("الملف المختار ليس صورة صالحة."));
      img.onload = () => {
        const MAX_W = 960;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        // Prefer WebP, fall back to JPEG
        let dataUrl = canvas.toDataURL("image/webp", 0.8);
        if (!dataUrl.startsWith("data:image/webp")) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        }
        resolve(dataUrl);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function resetForm() {
  el.formTitle.textContent = "➕ إضافة فعالية جديدة";
  el.idInput.value = "";
  el.titleInput.value = "";
  el.categoryInput.value = "فعالية";
  el.dateInput.value = eventsState.egyptNow?.egyptDate || "";
  el.timeInput.value = "17:00";
  el.locationInput.value = "";
  el.regUrlInput.value = "";
  el.descInput.value = "";
  el.cancelEditBtn.hidden = true;
  el.saveEventBtn.textContent = "💾 حفظ الفعالية";
  setPreviewImage(DEFAULT_PLACEHOLDER_STORED);
}

function populateFormForEdit(evt) {
  el.formTitle.textContent = `✏️ تعديل الفعالية: ${evt.title}`;
  el.idInput.value = evt.id || "";
  el.titleInput.value = evt.title || "";
  el.categoryInput.value = evt.category || "فعالية";
  el.dateInput.value = evt.egyptDate || "";
  el.timeInput.value = evt.egyptTime || "17:00";
  el.locationInput.value = evt.location || "";
  el.regUrlInput.value = evt.registrationUrl || "";
  el.descInput.value = evt.description || "";
  setPreviewImage(evt.image || DEFAULT_PLACEHOLDER_STORED);
  el.cancelEditBtn.hidden = false;
  el.saveEventBtn.textContent = "💾 حفظ التعديلات";
  el.formError.hidden = true;
  el.formSuccess.hidden = true;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderEventsList() {
  el.upcomingCount.textContent = String(eventsState.upcoming.length);
  el.passedCount.textContent = String(eventsState.passed.length);
  if (eventsState.egyptNow?.egyptDateArabic) {
    el.egyptNowMeta.textContent = `🇪🇬 توقيت مصر الآن: ${eventsState.egyptNow.egyptDateArabic} (Africa/Cairo)`;
  }

  const list = activeFilter === "upcoming" ? eventsState.upcoming : eventsState.passed;
  el.eventsContainer.innerHTML = "";

  if (!list || list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-admin-note";
    empty.textContent =
      activeFilter === "upcoming"
        ? "لا توجد فعاليات قادمة حالياً. أضف أول فعالية من النموذج بالأعلى."
        : "لا توجد فعاليات سابقة مسجلة حالياً.";
    el.eventsContainer.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "admin-events-list";

  list.forEach((evt) => {
    const card = document.createElement("div");
    card.className = "admin-event-item";

    const img = document.createElement("img");
    img.src = resolveAdminPreviewSrc(evt.image);
    img.alt = evt.title;
    img.onerror = () => {
      img.src = DEFAULT_PLACEHOLDER_ADMIN_PREVIEW;
    };
    card.appendChild(img);

    const body = document.createElement("div");
    body.className = "admin-event-body";

    const title = document.createElement("h3");
    title.textContent = evt.title;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "admin-event-meta";
    meta.textContent = `📅 ${evt.egyptDate} • ⏰ ${evt.egyptTime} بتوقيت مصر` + (evt.location ? ` • 📍 ${evt.location}` : "");
    body.appendChild(meta);

    if (evt.description) {
      const desc = document.createElement("div");
      desc.className = "admin-event-meta";
      desc.textContent = evt.description.slice(0, 120) + (evt.description.length > 120 ? "..." : "");
      body.appendChild(desc);
    }

    const actions = document.createElement("div");
    actions.className = "admin-event-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "studio-btn";
    editBtn.textContent = "✏️ تعديل";
    editBtn.addEventListener("click", () => populateFormForEdit(evt));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "studio-btn studio-btn--danger";
    delBtn.textContent = "🗑️ حذف";
    delBtn.addEventListener("click", () => handleDeleteEvent(evt));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    body.appendChild(actions);
    card.appendChild(body);
    grid.appendChild(card);
  });

  el.eventsContainer.appendChild(grid);
}

async function loadEvents() {
  try {
    const res = await fetch(`${API_BASE}/api/cms/events`, {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearToken();
      el.app.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }
    if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);

    eventsState = {
      upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
      passed: Array.isArray(data.passed) ? data.passed : [],
      egyptNow: data.egyptNow || null,
    };
    if (!el.dateInput.value && eventsState.egyptNow?.egyptDate) {
      el.dateInput.value = eventsState.egyptNow.egyptDate;
    }
    renderEventsList();
  } catch (err) {
    el.formError.textContent = err?.message || "تعذر تحميل قائمة الفعاليات.";
    el.formError.hidden = false;
  }
}

async function handleSaveEvent(e) {
  e.preventDefault();
  el.formError.hidden = true;
  el.formSuccess.hidden = true;
  el.saveEventBtn.disabled = true;
  el.saveEventBtn.textContent = "جاري الحفظ...";

  const manualUrl = el.imageUrlInput.value.trim();
  const finalImage = manualUrl || currentImageValue || DEFAULT_PLACEHOLDER_STORED;

  try {
    const res = await fetch(`${API_BASE}/api/cms/events`, {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        id: el.idInput.value.trim() || undefined,
        title: el.titleInput.value.trim(),
        category: el.categoryInput.value,
        egyptDate: el.dateInput.value,
        egyptTime: el.timeInput.value || "17:00",
        location: el.locationInput.value.trim(),
        registrationUrl: el.regUrlInput.value.trim(),
        description: el.descInput.value.trim(),
        image: finalImage,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearToken();
      el.app.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.message || `HTTP ${res.status}`);
    }

    eventsState = {
      upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
      passed: Array.isArray(data.passed) ? data.passed : [],
      egyptNow: data.egyptNow || eventsState.egyptNow,
    };
    resetForm();
    renderEventsList();
    el.formSuccess.textContent = "✅ تم حفظ الفعالية بنجاح وظهرت مباشرة في صفحة الفعاليات والمحادثة!";
    el.formSuccess.hidden = false;
  } catch (err) {
    el.formError.textContent = err?.message || "فشل حفظ الفعالية.";
    el.formError.hidden = false;
  } finally {
    el.saveEventBtn.disabled = false;
    el.saveEventBtn.textContent = el.idInput.value ? "💾 حفظ التعديلات" : "💾 حفظ الفعالية";
  }
}

async function handleDeleteEvent(evt) {
  if (!window.confirm(`هل أنت متأكد من حذف الفعالية "${evt.title}"؟`)) return;
  try {
    const res = await fetch(`${API_BASE}/api/cms/events/delete`, {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ id: evt.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      clearToken();
      el.app.hidden = true;
      el.loginOverlay.hidden = false;
      return;
    }
    if (!res.ok || !data?.ok) throw new Error(data?.message || `HTTP ${res.status}`);
    eventsState = {
      upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
      passed: Array.isArray(data.passed) ? data.passed : [],
      egyptNow: data.egyptNow || eventsState.egyptNow,
    };
    if (el.idInput.value === evt.id) resetForm();
    renderEventsList();
  } catch (err) {
    el.formError.textContent = err?.message || "فشل حذف الفعالية.";
    el.formError.hidden = false;
  }
}

async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/cms/prompt/session`, {
      method: "GET",
      credentials: "include",
      headers: getAuthHeaders(),
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
        adminName: el.adminNameInput.value.trim() || "Events Admin",
        password: el.adminPasswordInput.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.authenticated) {
      el.loginError.textContent = data?.message || "كلمة المرور غير صحيحة.";
      el.loginError.hidden = false;
      return;
    }
    if (data.token) {
      try {
        sessionStorage.setItem(TOKEN_KEY, data.token);
      } catch {
        // ignore
      }
    }
    el.adminPasswordInput.value = "";
    el.loginOverlay.hidden = true;
    el.app.hidden = false;
    await loadEvents();
  } catch {
    el.loginError.textContent = "تعذر الاتصال بخادم Cloudflare Worker.";
    el.loginError.hidden = false;
  } finally {
    el.loginSubmitBtn.disabled = false;
  }
}

async function handleLogout() {
  clearToken();
  try {
    await fetch(`${API_BASE}/api/cms/prompt/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  el.app.hidden = true;
  el.loginOverlay.hidden = false;
}

function setFilter(f) {
  activeFilter = f === "passed" ? "passed" : "upcoming";
  el.filterUpcomingBtn.classList.toggle("is-active", activeFilter === "upcoming");
  el.filterPassedBtn.classList.toggle("is-active", activeFilter === "passed");
  renderEventsList();
}

async function boot() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.logoutBtn.addEventListener("click", handleLogout);
  el.form.addEventListener("submit", handleSaveEvent);
  el.cancelEditBtn.addEventListener("click", resetForm);

  el.uploadImageBtn.addEventListener("click", () => el.imageFileInput.click());
  el.imageFileInput.addEventListener("change", async () => {
    const file = el.imageFileInput.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setPreviewImage(dataUrl);
    } catch (err) {
      el.formError.textContent = err?.message || "فشل تحميل الصورة.";
      el.formError.hidden = false;
    } finally {
      el.imageFileInput.value = "";
    }
  });
  el.resetImageBtn.addEventListener("click", () => setPreviewImage(DEFAULT_PLACEHOLDER_STORED));
  el.imageUrlInput.addEventListener("input", () => {
    const v = el.imageUrlInput.value.trim();
    if (v) {
      currentImageValue = v;
      el.imagePreview.src = resolveAdminPreviewSrc(v);
    } else if (!currentImageValue.startsWith("data:")) {
      setPreviewImage(DEFAULT_PLACEHOLDER_STORED);
    }
  });

  el.filterUpcomingBtn.addEventListener("click", () => setFilter("upcoming"));
  el.filterPassedBtn.addEventListener("click", () => setFilter("passed"));

  const ok = await checkSession();
  if (ok) {
    el.loginOverlay.hidden = true;
    el.app.hidden = false;
    await loadEvents();
  } else {
    el.loginOverlay.hidden = false;
    el.app.hidden = true;
  }
}

boot();
