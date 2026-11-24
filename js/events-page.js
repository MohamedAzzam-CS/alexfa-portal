// ============================================================================
// Alexanders Public Events Page Controller
// - Fetches live events from GET /api/events (strictly Egypt time Africa/Cairo)
// - Two filters: Upcoming Events & Passed Events
// - Uses branded placeholder image (assets/event-placeholder.svg) when empty
//   or when an event image hasn't been uploaded yet from admin/events.html
// ============================================================================

const DEFAULT_WORKER_ORIGIN = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev";
const API_BASE =
  typeof window !== "undefined" && typeof window.ALEXANDERS_EVENTS_API_BASE === "string"
    ? window.ALEXANDERS_EVENTS_API_BASE
    : typeof window !== "undefined" && window.location.hostname.endsWith(".workers.dev")
      ? ""
      : DEFAULT_WORKER_ORIGIN;

const PLACEHOLDER_IMAGE = "assets/event-placeholder.svg";

const container = document.getElementById("eventsContainer");
const filterUpcomingBtn = document.getElementById("filterUpcomingBtn");
const filterPassedBtn = document.getElementById("filterPassedBtn");
const upcomingCountBadge = document.getElementById("upcomingCountBadge");
const passedCountBadge = document.getElementById("passedCountBadge");
const egyptClockBadge = document.getElementById("egyptClockBadge");

let activeFilter = "upcoming";
let eventsState = { upcoming: [], passed: [], egyptNow: null };

function formatEgyptTime12h(hhmm) {
  if (!hhmm || !hhmm.includes(":")) return hhmm || "";
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr);
  const period = h >= 12 ? "م" : "ص";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

function renderEmptyState(filter) {
  const isUpcoming = filter === "upcoming";
  const box = document.createElement("div");
  box.className = "events-empty";

  const img = document.createElement("img");
  img.src = PLACEHOLDER_IMAGE;
  img.alt = "Alexanders Events Placeholder";
  box.appendChild(img);

  const body = document.createElement("div");
  body.className = "events-empty-body";

  const h3 = document.createElement("h3");
  h3.textContent = isUpcoming
    ? "لا توجد فعاليات قادمة معلنة حالياً"
    : "لا توجد فعاليات سابقة مسجلة حالياً";

  const p = document.createElement("p");
  p.textContent = isUpcoming
    ? "ترقبوا الإعلان عن الفعاليات والورش الجديدة قريباً هنا (جميع المواعيد بتوقيت مصر)."
    : "ستظهر الفعاليات المنتهية هنا تلقائياً فور انتهاء موعدها بتوقيت مصر.";

  body.appendChild(h3);
  body.appendChild(p);
  box.appendChild(body);
  container.appendChild(box);
}

function renderEvents() {
  if (!container) return;
  container.innerHTML = "";

  const list = activeFilter === "upcoming" ? eventsState.upcoming : eventsState.passed;
  if (!list || list.length === 0) {
    renderEmptyState(activeFilter);
    return;
  }

  const grid = document.createElement("div");
  grid.className = "events-grid";

  list.forEach((evt) => {
    const card = document.createElement("article");
    card.className = "event-card";

    const media = document.createElement("div");
    media.className = "event-card-media";

    const img = document.createElement("img");
    img.src = evt.image || PLACEHOLDER_IMAGE;
    img.alt = evt.title || "Alexanders Event";
    img.loading = "lazy";
    img.onerror = () => {
      img.src = PLACEHOLDER_IMAGE;
    };
    media.appendChild(img);

    const statusBadge = document.createElement("span");
    statusBadge.className = `event-status-badge event-status-badge--${evt.status === "passed" ? "passed" : "upcoming"}`;
    statusBadge.textContent = evt.status === "passed" ? "فعالية سابقة" : "فعالية قادمة";
    media.appendChild(statusBadge);
    card.appendChild(media);

    const body = document.createElement("div");
    body.className = "event-card-body";

    if (evt.category) {
      const cat = document.createElement("span");
      cat.className = "event-category";
      cat.textContent = evt.category;
      body.appendChild(cat);
    }

    const title = document.createElement("h3");
    title.textContent = evt.title;
    body.appendChild(title);

    const meta = document.createElement("div");
    meta.className = "event-meta-list";

    const dateLine = document.createElement("div");
    dateLine.textContent = `📅 ${evt.egyptDate} • ⏰ ${formatEgyptTime12h(evt.egyptTime)} (بتوقيت مصر)`;
    meta.appendChild(dateLine);

    if (evt.location) {
      const locLine = document.createElement("div");
      locLine.textContent = `📍 ${evt.location}`;
      meta.appendChild(locLine);
    }
    body.appendChild(meta);

    if (evt.description) {
      const desc = document.createElement("p");
      desc.className = "event-desc";
      desc.textContent = evt.description;
      body.appendChild(desc);
    }

    if (evt.registrationUrl && evt.status === "upcoming") {
      const cta = document.createElement("a");
      cta.className = "event-cta";
      cta.href = evt.registrationUrl;
      cta.target = "_blank";
      cta.rel = "noopener noreferrer";
      cta.textContent = "سجّل الآن ←";
      body.appendChild(cta);
    }

    card.appendChild(body);
    grid.appendChild(card);
  });

  container.appendChild(grid);
}

function setFilter(filter) {
  activeFilter = filter === "passed" ? "passed" : "upcoming";
  const isUp = activeFilter === "upcoming";
  filterUpcomingBtn?.classList.toggle("is-active", isUp);
  filterUpcomingBtn?.setAttribute("aria-selected", String(isUp));
  filterPassedBtn?.classList.toggle("is-active", !isUp);
  filterPassedBtn?.setAttribute("aria-selected", String(!isUp));
  renderEvents();
}

async function loadEvents() {
  try {
    const res = await fetch(`${API_BASE}/api/events`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    eventsState = {
      upcoming: Array.isArray(data.upcoming) ? data.upcoming : [],
      passed: Array.isArray(data.passed) ? data.passed : [],
      egyptNow: data.egyptNow || null,
    };
  } catch {
    eventsState = { upcoming: [], passed: [], egyptNow: null };
  }

  if (upcomingCountBadge) upcomingCountBadge.textContent = String(eventsState.upcoming.length);
  if (passedCountBadge) passedCountBadge.textContent = String(eventsState.passed.length);
  if (egyptClockBadge && eventsState.egyptNow?.egyptDateArabic) {
    egyptClockBadge.textContent = `🇪🇬 توقيت مصر الآن: ${eventsState.egyptNow.egyptDateArabic}`;
  }
  renderEvents();
}

filterUpcomingBtn?.addEventListener("click", () => setFilter("upcoming"));
filterPassedBtn?.addEventListener("click", () => setFilter("passed"));

loadEvents();
