// ==============================================================================
// Alexanders AI Assistant - Dual-Mode Client (Instant JSON + Live SSE Streaming)
// ==============================================================================
(function () {
  const CHAT_API_ENDPOINT = "https://alexanders-ai-api.sci-mohamedelsayed32561.workers.dev/";
  const TIMEOUT_MS = 25000;
  let chatHistory = [];

  function injectChatWidgetDOM() {
    if (document.getElementById("aiChatWidget")) return;

    const widgetHTML = `
      <div id="aiChatWidget" class="ai-chat-widget">
        <!-- Chat Panel -->
        <div id="aiChatPanel" class="ai-chat-panel" role="dialog" aria-label="Alexanders AI Assistant">
          <!-- Header -->
          <div class="ai-chat-header">
            <div class="ai-chat-header-info">
              <div class="ai-chat-avatar">✦</div>
              <div class="ai-chat-title-group">
                <h3>مساعد ألكساندرز</h3>
                <div class="ai-chat-status">
                  <span class="ai-chat-status-dot"></span>
                  <span id="aiChatStatusText">متصل</span>
                </div>
              </div>
            </div>
            <div class="ai-chat-header-actions">
              <button id="aiChatResetBtn" class="ai-chat-btn-action" title="إعادة تعيين المحادثة">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                <span>إعادة ضبط</span>
              </button>
              <button id="aiChatCloseBtn" class="ai-chat-btn-close" aria-label="إغلاق">✕</button>
            </div>
          </div>

          <!-- Messages Area -->
          <div id="aiChatMessages" class="ai-chat-messages">
            <div class="ai-message assistant">
              <div class="ai-message-content">مرحبًا بك في ألكساندرز! 👋<br>أنا المساعد السريع للمجتمع. اسألني عن لجاننا، فعالياتنا، قيادتنا، أو طريقة الانضمام!</div>
            </div>
          </div>

          <!-- Input Bar -->
          <div class="ai-chat-input-bar">
            <form id="aiChatForm" class="ai-chat-input-wrapper">
              <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="اكتب استفسارك هنا..." autocomplete="off" />
              <button type="submit" id="aiChatSendBtn" class="ai-chat-send-btn" aria-label="إرسال">
                <svg class="ai-chat-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"></line>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
              </button>
            </form>
          </div>
        </div>

        <!-- Floating Trigger Button -->
        <button id="aiChatToggleBtn" class="ai-chat-toggle-btn" aria-label="فتح المساعد الذكي">
          <span class="ai-chat-badge"></span>
          <svg class="ai-chat-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
        </button>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", widgetHTML);
    bindChatEvents();
  }

  function bindChatEvents() {
    const toggleBtn = document.getElementById("aiChatToggleBtn");
    const closeBtn = document.getElementById("aiChatCloseBtn");
    const resetBtn = document.getElementById("aiChatResetBtn");
    const form = document.getElementById("aiChatForm");
    const input = document.getElementById("aiChatInput");
    const sendBtn = document.getElementById("aiChatSendBtn");
    const messages = document.getElementById("aiChatMessages");
    const widget = document.getElementById("aiChatWidget");
    const latencyBadge = document.getElementById("aiChatLatencyBadge");

    function setOpen(open) {
      widget?.classList.toggle("active", open);
      toggleBtn?.classList.toggle("open", open);
      toggleBtn?.setAttribute("aria-expanded", String(open));
      if (open) setTimeout(() => input?.focus(), 150);
    }

    toggleBtn?.addEventListener("click", () => setOpen(!widget?.classList.contains("active")));
    closeBtn?.addEventListener("click", () => setOpen(false));

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });

    resetBtn?.addEventListener("click", () => {
      chatHistory = [];
      if (messages) {
        messages.innerHTML = `
          <div class="ai-message assistant">
            <div class="ai-message-content">تمت إعادة ضبط المحادثة. كيف يمكنني مساعدتك؟</div>
          </div>
        `;
      }
      if (latencyBadge) latencyBadge.textContent = "⚡ تم التعيين";
    });

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const userText = input?.value?.trim();
      if (!userText) return;

      appendMessage("user", userText);
      input.value = "";
      input.disabled = true;
      if (sendBtn) sendBtn.disabled = true;

      const assistantMsgElem = appendMessage("assistant", "...");
      const contentEl = assistantMsgElem.querySelector(".ai-message-content");
      const startTime = performance.now();
      if (latencyBadge) latencyBadge.textContent = "⏳ جاري المعالجة...";

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const payload = {
          message: userText,
          history: chatHistory.slice(-4),
        };

        const res = await fetch(CHAT_API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          clearTimeout(timeoutId);
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }

        const contentType = res.headers.get("content-type") || "";
        let replyText = "";

        if (contentType.includes("text/event-stream") && res.body) {
          // Live SSE Streaming Mode
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let gotFirstToken = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith("data:")) continue;
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr || dataStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.token) {
                  if (!gotFirstToken) {
                    gotFirstToken = true;
                    clearTimeout(timeoutId);
                    const ttftMs = Math.round(performance.now() - startTime);
                    if (latencyBadge) latencyBadge.textContent = `⚡ TTFT ${ttftMs}ms`;
                  }
                  replyText += parsed.token;
                  contentEl.innerHTML = formatReply(replyText);
                  scrollToBottom();
                }
              } catch {
                // Ignore partial SSE JSON frames
              }
            }
          }

          clearTimeout(timeoutId);
          replyText = replyText.trim() || "عذرًا، لم أتمكن من الحصول على رد.";
          contentEl.innerHTML = formatReply(replyText);
        } else {
          // Instant JSON Mode (Regex, Exact Cache, Semantic Cache, or Short Fact)
          clearTimeout(timeoutId);
          const rttMs = Math.round(performance.now() - startTime);
          if (latencyBadge) latencyBadge.textContent = `⚡ ${rttMs}ms`;

          const data = await res.json();
          replyText = data.reply?.trim() || "عذرًا، لم أتمكن من الحصول على رد.";
          contentEl.innerHTML = formatReply(replyText);
        }

        chatHistory.push({ role: "user", text: userText });
        chatHistory.push({ role: "assistant", text: replyText });
      } catch (err) {
        clearTimeout(timeoutId);
        const msg =
          err.name === "AbortError"
            ? "انتهت مهلة الانتظار. يرجى المحاولة مرة أخرى."
            : err.message || "حدث خطأ غير متوقع.";

        contentEl.innerHTML = `<span style="color:#ef4444;">⚠️ ${escapeHtml(msg)}</span>`;
      } finally {
        input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
        scrollToBottom();
      }
    });
  }

  function appendMessage(role, text) {
    const container = document.getElementById("aiChatMessages");
    if (!container) return null;

    const msgDiv = document.createElement("div");
    msgDiv.className = `ai-message ${role}`;

    const contentDiv = document.createElement("div");
    contentDiv.className = "ai-message-content";
    contentDiv.textContent = text;

    msgDiv.appendChild(contentDiv);
    container.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv;
  }

  function scrollToBottom() {
    const container = document.getElementById("aiChatMessages");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function formatReply(str) {
    return escapeHtml(str)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\n/g, "<br>");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectChatWidgetDOM);
  } else {
    injectChatWidgetDOM();
  }
})();
