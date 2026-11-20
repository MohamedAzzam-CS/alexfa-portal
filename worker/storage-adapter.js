// ============================================================================
// Temporary Weekly Storage Adapter (Cloudflare KV / R2 -> D1/PostgreSQL ready)
// Swapping to Cloudflare D1 or PostgreSQL later requires modifying ONLY this file.
// ============================================================================

const memoryWeeklyLogs = new Map();
const memorySessionLinks = new Map();

/**
 * Computes the ISO-8601 week string (e.g. "2026-W47") for a given Date.
 */
export function getIsoWeek(dateInput = new Date()) {
  const date = new Date(
    Date.UTC(
      dateInput.getUTCFullYear(),
      dateInput.getUTCMonth(),
      dateInput.getUTCDate()
    )
  );
  // Thursday in current week decides the ISO year
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Unified StorageAdapter interface for weekly partitioned chat turn logging
 * and pre-login guest session -> authenticated account linking.
 */
export class StorageAdapter {
  constructor(env = {}) {
    this.kv = env.WEEKLY_LOGS_KV || null;
    this.r2 = env.WEEKLY_LOGS_BUCKET || null;
  }

  /**
   * Formats and persists a single chat turn partitioned by ISO week.
   */
  async logChatTurn({
    id = crypto.randomUUID(),
    timestamp = new Date().toISOString(),
    isoWeek = getIsoWeek(new Date(timestamp)),
    type = "chat",
    faqRef = null,
    sessionId,
    isAuthenticated = false,
    userId = null,
    email = null,
    username = null,
    userMessage,
    assistantResponse,
  }) {
    // Check if this guest sessionId was already linked to an authenticated user
    let resolvedUser = { userId, email, username };
    if (!resolvedUser.userId && sessionId) {
      const linked = await this.getSessionLink(sessionId);
      if (linked) {
        resolvedUser = {
          userId: linked.userId || null,
          email: linked.email || null,
          username: linked.username || null,
        };
      }
    }

    const record = {
      id,
      timestamp,
      isoWeek,
      type: type === "faq" ? "faq" : "chat",
      faqRef: faqRef || null,
      sessionId: sessionId || "anon_unknown",
      isAuthenticated: Boolean(isAuthenticated),
      userId: resolvedUser.userId || null,
      email: resolvedUser.email || null,
      username: resolvedUser.username || null,
      userMessage: String(userMessage || ""),
      assistantResponse: String(assistantResponse || ""),
    };

    // 1. Cloudflare KV storage (indexed per-week array + individual turn key)
    if (this.kv) {
      const turnKey = `turn:${isoWeek}:${record.timestamp}:${record.id}`;
      const weekSessionKey = `week:${isoWeek}:session:${record.sessionId}`;
      const weekIndexKey = `week:${isoWeek}:turns`;

      await this.kv.put(turnKey, JSON.stringify(record), {
        metadata: {
          isoWeek,
          sessionId: record.sessionId,
          userId: record.userId,
          isAuthenticated: record.isAuthenticated,
        },
      });

      // Append to session-scoped weekly list for fast pre-login guest retroactive linking
      const sessionTurns =
        (await this.kv.get(weekSessionKey, { type: "json" })) || [];
      sessionTurns.push(record);
      await this.kv.put(weekSessionKey, JSON.stringify(sessionTurns));

      // Append to weekly partition log array
      const weeklyTurns =
        (await this.kv.get(weekIndexKey, { type: "json" })) || [];
      weeklyTurns.push(record);
      await this.kv.put(weekIndexKey, JSON.stringify(weeklyTurns));
    }

    // 2. Cloudflare R2 bucket storage (append-style weekly object + individual object)
    if (this.r2) {
      const objectKey = `logs/${isoWeek}/${record.sessionId}/${record.id}.json`;
      await this.r2.put(objectKey, JSON.stringify(record, null, 2), {
        httpMetadata: { contentType: "application/json" },
        customMetadata: {
          isoWeek,
          sessionId: record.sessionId,
          userId: record.userId || "",
        },
      });

      const weeklyFileKey = `logs/${isoWeek}/weekly-log.json`;
      const existingObj = await this.r2.get(weeklyFileKey);
      const existingList = existingObj ? await existingObj.json() : [];
      existingList.push(record);
      await this.r2.put(weeklyFileKey, JSON.stringify(existingList, null, 2), {
        httpMetadata: { contentType: "application/json" },
      });
    }

    // 3. In-memory fallback for local development when KV/R2 bindings aren't attached
    if (!this.kv && !this.r2) {
      const list = memoryWeeklyLogs.get(isoWeek) || [];
      list.push(record);
      memoryWeeklyLogs.set(isoWeek, list);
    }

    return record;
  }

  /**
   * Associates a pre-login guest sessionId with an authenticated Puter user identity
   * (userId, email, username) and retroactively updates all prior guest turns in that session.
   */
  async linkSessionToUser(sessionId, { userId, email = null, username = null }, isoWeek = getIsoWeek()) {
    if (!sessionId || !userId) return { linkedCount: 0 };

    const linkPayload = {
      sessionId,
      userId,
      email: email || null,
      username: username || null,
      linkedAt: new Date().toISOString(),
      isoWeek,
    };

    let linkedCount = 0;

    if (this.kv) {
      await this.kv.put(`session_link:${sessionId}`, JSON.stringify(linkPayload));

      // Retroactively update session turns in the current ISO week
      const weekSessionKey = `week:${isoWeek}:session:${sessionId}`;
      const sessionTurns =
        (await this.kv.get(weekSessionKey, { type: "json" })) || [];

      if (sessionTurns.length > 0) {
        for (const turn of sessionTurns) {
          turn.userId = userId;
          turn.email = email || turn.email || null;
          turn.username = username || turn.username || null;
          linkedCount++;

          const turnKey = `turn:${turn.isoWeek}:${turn.timestamp}:${turn.id}`;
          await this.kv.put(turnKey, JSON.stringify(turn), {
            metadata: {
              isoWeek: turn.isoWeek,
              sessionId: turn.sessionId,
              userId: turn.userId,
              isAuthenticated: turn.isAuthenticated,
            },
          });
        }
        await this.kv.put(weekSessionKey, JSON.stringify(sessionTurns));
      }

      // Update weekly partition index entries for this sessionId
      const weekIndexKey = `week:${isoWeek}:turns`;
      const weeklyTurns =
        (await this.kv.get(weekIndexKey, { type: "json" })) || [];
      let updatedIndex = false;
      for (const turn of weeklyTurns) {
        if (turn.sessionId === sessionId && !turn.userId) {
          turn.userId = userId;
          turn.email = email || turn.email || null;
          turn.username = username || turn.username || null;
          updatedIndex = true;
        }
      }
      if (updatedIndex) {
        await this.kv.put(weekIndexKey, JSON.stringify(weeklyTurns));
      }
    }

    if (this.r2) {
      await this.r2.put(
        `links/${sessionId}.json`,
        JSON.stringify(linkPayload, null, 2),
        { httpMetadata: { contentType: "application/json" } }
      );

      const weeklyFileKey = `logs/${isoWeek}/weekly-log.json`;
      const existingObj = await this.r2.get(weeklyFileKey);
      if (existingObj) {
        const weeklyList = await existingObj.json();
        let changed = false;
        for (const turn of weeklyList) {
          if (turn.sessionId === sessionId) {
            turn.userId = userId;
            turn.email = email || turn.email || null;
            turn.username = username || turn.username || null;
            changed = true;
            linkedCount++;
          }
        }
        if (changed) {
          await this.r2.put(weeklyFileKey, JSON.stringify(weeklyList, null, 2), {
            httpMetadata: { contentType: "application/json" },
          });
        }
      }
    }

    if (!this.kv && !this.r2) {
      memorySessionLinks.set(sessionId, linkPayload);
      const list = memoryWeeklyLogs.get(isoWeek) || [];
      for (const turn of list) {
        if (turn.sessionId === sessionId) {
          turn.userId = userId;
          turn.email = email || turn.email || null;
          turn.username = username || turn.username || null;
          linkedCount++;
        }
      }
    }

    return { linkedCount, ...linkPayload };
  }

  async getSessionLink(sessionId) {
    if (!sessionId) return null;
    if (this.kv) {
      return await this.kv.get(`session_link:${sessionId}`, { type: "json" });
    }
    if (this.r2) {
      const obj = await this.r2.get(`links/${sessionId}.json`);
      return obj ? await obj.json() : null;
    }
    return memorySessionLinks.get(sessionId) || null;
  }

  /**
   * Retrieves all logged chat turns for a given ISO Week (e.g. "2026-W47").
   */
  async getWeeklyLogs(isoWeek = getIsoWeek()) {
    if (this.kv) {
      return (await this.kv.get(`week:${isoWeek}:turns`, { type: "json" })) || [];
    }
    if (this.r2) {
      const obj = await this.r2.get(`logs/${isoWeek}/weekly-log.json`);
      return obj ? await obj.json() : [];
    }
    return memoryWeeklyLogs.get(isoWeek) || [];
  }
}
