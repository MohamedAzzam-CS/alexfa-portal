// ============================================================================
// Server-Side Puter AI Inference Engine (https://api.puter.com/drivers/call)
// Executes strictly inside the Cloudflare Worker so the system prompt is
// NEVER exposed in browser network traffic.
// ============================================================================

import { SOCIAL_LINKS } from "./system-prompt.js";

const PUTER_DRIVERS_ENDPOINT = "https://api.puter.com/drivers/call";

const MODEL_CANDIDATES = [
  { driver: "openrouter", model: "google/gemini-2.5-flash" },
  { driver: "openai-completion", model: "gpt-4o-mini" },
  { driver: "deepseek", model: "deepseek-chat" },
  { driver: "openai-completion", model: "gpt-4o" },
];

/**
 * Extracts assistant text from Puter /drivers/call response JSON.
 */
function extractPuterResponseText(data) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();

  const res = data.result ?? data;
  if (typeof res === "string") return res.trim();

  // Standard Puter chat completion response shapes
  const content =
    res?.message?.content ??
    res?.choices?.[0]?.message?.content ??
    res?.text ??
    data?.message?.content ??
    data?.choices?.[0]?.message?.content ??
    "";

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("")
      .trim();
  }

  return typeof content === "string" ? content.trim() : "";
}

/**
 * Calls https://api.puter.com/drivers/call from the Cloudflare Worker
 * using the active Puter token (User-Pays token when authenticated, or
 * env.GUEST_PUTER_TOKEN when in 5-message guest mode).
 */
export async function callPuterAiFromWorker({
  messages,
  puterToken,
  userMessage,
  isGuest = false,
  env = {},
}) {
  // If we have a valid Puter token (either user's own token or server GUEST_PUTER_TOKEN),
  // execute inference via Puter's /drivers/call API.
  if (puterToken && puterToken !== "PUT_YOUR_GUEST_PUTER_TOKEN_HERE") {
    let lastError = null;

    for (const candidate of MODEL_CANDIDATES) {
      try {
        const payload = {
          interface: "puter-chat-completion",
          driver: candidate.driver,
          method: "complete",
          args: {
            messages,
            model: candidate.model,
            stream: false,
            temperature: 0.2,
          },
        };

        const response = await fetch(PUTER_DRIVERS_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${puterToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            Origin: "https://puter.com",
            Referer: "https://puter.com/",
          },
          body: JSON.stringify(payload),
        });

        if (response.status === 401 || response.status === 403) {
          const errText = await response.text().catch(() => "");
          const authErr = new Error(
            `Puter token rejected (${response.status}): ${errText.slice(0, 160)}`
          );
          authErr.status = response.status;
          authErr.isAuthError = true;
          throw authErr;
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          lastError = new Error(
            `Puter driver ${candidate.driver}/${candidate.model} HTTP ${response.status}: ${errText.slice(0, 160)}`
          );
          continue;
        }

        const data = await response.json();
        if (data?.success === false) {
          const errMsg =
            data?.error?.message || data?.error || "Puter driver returned success=false";
          if (/auth|token|unauthorized|permission/i.test(String(errMsg))) {
            const authErr = new Error(String(errMsg));
            authErr.status = 401;
            authErr.isAuthError = true;
            throw authErr;
          }
          lastError = new Error(String(errMsg));
          continue;
        }

        const text = extractPuterResponseText(data);
        if (text) {
          return {
            reply: text,
            model: candidate.model,
            driver: candidate.driver,
          };
        }
      } catch (err) {
        if (err?.isAuthError && !isGuest) {
          throw err;
        }
        lastError = err;
      }
    }

    // If grounded server-side knowledge base can answer the query as fallback, use it
    const fallbackReply = matchGroundedKnowledgeBase(userMessage);
    if (fallbackReply) {
      return {
        reply: fallbackReply,
        model: "alexanders-kb-engine",
        driver: "worker-kb",
      };
    }

    throw lastError || new Error("All Puter AI models failed to respond.");
  }

  // When GUEST_PUTER_TOKEN is not set, run AI inference via Cloudflare Workers AI (env.AI) first
  if (env?.AI && typeof env.AI.run === "function") {
    const cfModels = [
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      "@cf/meta/llama-3.1-8b-instruct",
    ];
    for (const cfModel of cfModels) {
      try {
        const aiRes = await env.AI.run(cfModel, {
          messages,
          temperature: 0.2,
          max_tokens: 700,
        });
        const text = String(aiRes?.response || "").trim();
        if (text) {
          return {
            reply: text,
            model: cfModel,
            driver: "cloudflare-workers-ai-guest-fallback",
          };
        }
      } catch {
        // Try next candidate
      }
    }
  }

  // Last-resort offline fallback when running locally without Puter token or Workers AI binding
  const kbReply = matchGroundedKnowledgeBase(userMessage);
  if (kbReply) {
    return {
      reply: kbReply,
      model: "alexanders-kb-engine",
      driver: "worker-kb",
    };
  }

  throw new Error(
    "GUEST_PUTER_TOKEN is not configured on the Worker for open-ended guest inference."
  );
}

// ============================================================================
// Server-Side Grounded Knowledge Base Matcher (Worker-Only Fallback)
// ============================================================================
function normalizeQuery(text) {
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

function isEnglishQuery(text) {
  const stripped = String(text || "").replace(/https?:\/\/\S+/g, " ");
  const ar = (stripped.match(/[\u0600-\u06FF]/g) || []).length;
  const en = (stripped.match(/[A-Za-z]/g) || []).length;
  return en > ar;
}

export function matchGroundedKnowledgeBase(rawText) {
  const norm = normalizeQuery(rawText);
  if (!norm) return null;
  const isEn = isEnglishQuery(rawText);
  const {
    FB_URL,
    IG_URL,
    LINKEDIN_URL,
    TIKTOK_URL,
    YOUTUBE_URL,
    INTRO_VIDEO_URL,
    MEMBER_FORM_URL,
    BOARD_FORM_URL,
  } = SOCIAL_LINKS;

  // Greetings
  if (
    /^(hi|hello|hey|yo|hola|good morning|good evening|اهلا|اهلا بيك|اهلا وسهلا|مرحبا|السلام عليكم|سلام عليكم|ازيك|ازيكم|عامل ايه|صباح الخير|مساء الخير|هاي|هالو)$/.test(
      norm
    )
  ) {
    return isEn
      ? "Hello and welcome to **Alexanders Group** at Alexandria University! 👋 How can I help you today? You can ask me about our 6 committees, eligibility, membership types, past events, or how to apply."
      : "أهلاً بك في كيان **ألكساندرز (Alexanders Group)** بجامعة الإسكندرية! 👋 إزاي أقدر أساعدك النهاردة؟ تقدر تسألني عن اللجان الـ 6، شروط الانضمام، الفرق بين أنواع العضوية، الفعاليات السابقة، أو طريقة التقديم.";
  }

  // Dates / Deadlines Rule
  if (
    /(امتي|امتا|متي|ميعاد|موعد|مواعيد|ديدلاين|when|date|deadline|schedule)/.test(norm) &&
    /(تقديم|انترفيو|مقابله|كورس|ايفنت|فعاليه|فتح|فاتح|مفتوح|recruitment|registration|application|interview|event)/.test(
      norm
    )
  ) {
    return isEn
      ? `Schedules and dates for recruitment, interviews, courses, and events are announced dynamically on our official social media pages (not fixed in advance). Follow us for updates:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\nIf you already submitted the form, an HR team member will contact you via WhatsApp to arrange your interview.`
      : `مواعيد التقديم، الانترفيوهات، الكورسات، والفعاليات بتُعلن بشكل متجدد أول بأول على صفحاتنا الرسمية مش بمواعيد ثابتة:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\nوبالنسبة للي ملأ الفورم بالفعل، بيتواصل معاه مسؤول من الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو.`;
  }

  // Board application
  if (/(بورد|board)/.test(norm) && /(اقدم|تقديم|فورم|لينك|رابط|apply|form|link)/.test(norm)) {
    return isEn
      ? `You can apply for **The Board** here:\n[board_application_form](${BOARD_FORM_URL})\nAfter submitting the form, an HR representative will contact you via WhatsApp to schedule your interview date, time, and location.`
      : `تقدر تقدم على **البورد (Board)** من هنا:\n[board_application_form](${BOARD_FORM_URL})\nوبعد ملء الفورم، هيتواصل معاك ممثل من لجنة الـ HR على واتساب لتحديد ميعاد ومكان المقابلة.`;
  }

  // Member vs General Member
  if (
    /(general member|عضو عام|اعضاء عامون|الاعضاء العامون|انواع العضويه|membership types)/.test(
      norm
    )
  ) {
    return isEn
      ? "We have **2 membership types**:\n- **Committee Members:** Join 1 of our 6 committees after passing an interview, help plan & run activities, and ALWAYS get top priority for all events, courses, workshops, and trips.\n- **General Members:** Join the community and attend activities without committee or organizational duties, based on available spots after Committee Members."
      : "فيه نوعين للعضوية في **Alexanders Group**:\n- **أعضاء اللجان (Committee Members):** بتنضم لإحدى اللجان الـ 6 بعد الانترفيو، وتشارك في تخطيط وتنفيذ الأنشطة والفعاليات، وليك دائماً **الأولوية المطلقة** في حضور كل الإيفنتات والكورسات والورش والرحلات.\n- **الأعضاء العامون (General Members):** بتكون جزء من عائلة الكيان وتحضر الأنشطة بدون الانضمام للجنة أو مسؤوليات تنظيمية، حسب الأماكن المتاحة وطبيعة النشاط بعد إعطاء الأولوية لأعضاء اللجان.";
  }

  // Difference between Members and Board / Promotions
  if (/(الفرق بين الاعضاء والبورد|ترقيات|اترقي|promotion|members and the board)/.test(norm)) {
    return isEn
      ? "**Committee Members** are the operational backbone executing tasks and organizing activities, while **The Board** (Entity President, Vice Presidents, Committee Heads & Vice Heads) handles strategic planning, decision-making, and supervising committees.\n\n**Promotion Ladder** (earned by commitment & performance, not fixed time):\n1. Member\n2. Active Member\n3. Senior\n4. Vice Head (Lead)\n5. Head (Leader)"
      : "الفرق بين الأعضاء والبورد:\n- **أعضاء اللجان (Members):** هم العمود الفقري التشغيلي للكيان اللي بينفذوا المهام وينظموا الأنشطة جوا لجانهم.\n- **البورد (The Board):** قيادة الكيان واللجان (رئيس الكيان، نواب الرئيس، وهيدز وفايسز اللجان)، ومسؤولين عن التخطيط الاستراتيجي وإدارة الفرق واتخاذ القرارات.\n\n**نظام الترقيات** (حسب الالتزام والأداء مش بمدة ثابتة):\n1. Member\n2. Active Member\n3. Senior\n4. Vice Head (Lead)\n5. Head (Leader)";
  }

  // Eligibility
  if (/(مين يقدر ينضم|شروط الانضمام|شروط التقديم|who can join|eligible|eligibility)/.test(norm)) {
    return isEn
      ? "**Eligibility:** Open exclusively to undergraduate students in any faculty or academic year at **Alexandria University** or **Alexandria National University**.\n\n**Not Eligible:** Graduates, internship-year students (سنة الامتياز), institute students (المعاهد), or students from other universities."
      : "**شروط الانضمام:**\n- **متاح حصرياً لـ:** جميع طلاب المرحلة الجامعية بأي كلية أو فرقة في **جامعة الإسكندرية** و **جامعة الإسكندرية الأهلية**.\n- **غير متاح لـ:** الخريجين، طلبة سنة الامتياز، طلاب المعاهد، أو طلاب الجامعات الأخرى.";
  }

  // Individual committees
  if (/(لجنه التنظيم|\boc\b|organizing committee)/.test(norm)) {
    return isEn
      ? "**Organizing Committee (OC - لجنة التنظيم):**\n- **Role:** Field management and logistics — planning, organizing, and executing events, conferences, and trips on the ground, maintaining order, and handling unexpected on-site situations quickly.\n- **Ideal Traits:** Strong organization skills, quick problem-solving, working well under pressure, teamwork, and high on-ground energy."
      : "**لجنة التنظيم (Organizing Committee - OC):**\n- **الدور والمهام:** الإدارة الميدانية واللوجستيات؛ مسؤولة عن تخطيط وتنظيم وتنفيذ الإيفنتات والمؤتمرات والرحلات على أرض الواقع، وحفظ النظام، والتعامل السريع والهادئ مع أي مواقف طارئة.\n- **المهارات المطلوبة:** مهارات تنظيمية قوية، سرعة حل المشكلات، العمل تحت ضغط، روح الفريق، والنشاط الميداني.";
  }

  if (/(hr follower|انذارات|3 strikes|warning policy|العضو المميز|member of the month)/.test(norm)) {
    return isEn
      ? "**HR Support, Warnings & Recognition Policy:**\n- **HR Follower System:** Every committee member gets a dedicated HR Follower who supports them step-by-step and helps balance university studies with entity tasks.\n- **3-Strikes Warning Policy:** Members receive up to 3 warnings (Strikes) only if they ignore their HR Follower, repeatedly miss meetings without a valid excuse, or neglect tasks without communicating. A 3rd strike results in removal (Filtration). Valid academic or personal excuses are always respected when communicated!\n- **Member of the Month (VIP):** The most active member each month is honored publicly and receives VIP priority in all activities."
      : "**نظام المتابعة (HR Follower) والإنذارات والتكريم:**\n- **HR Follower:** لكل عضو في اللجان مسؤول متابعة مخصص بيدعمه خطوة بخطوة ويساعده يحل أي عقبة ويوازن بين الكلية والكيان.\n- **سياسة الـ 3 إنذارات (3-Strikes Policy):** بيحصل العضو على إنذار فقط في حالة تجاهل الـ HR Follower (\"الكرف\") أو الغياب المتكرر وإهمال المهام بدون عذر أو تواصل، وعند الإنذار الثالث يتم الإعفاء (Filtration). أما الأعذار الحقيقية زي الامتحانات وضغط الدراسة فمقدّرة تماماً طالما فيه تواصل.\n- **العضو المميز (Member of the Month - VIP):** بيتكرم أنشط عضو شهرياً قدام الكيان كله وبيحصل على أولوية وتسهيلات VIP في جميع الأنشطة.";
  }

  if (/(لجنه الموارد البشريه|لجنه ال hr|\bhr\b|human resources)/.test(norm)) {
    return isEn
      ? "**Human Resources Committee (HR - لجنة الموارد البشرية):**\n- **Role:** People management and internal development — running recruitment interviews, tracking and evaluating member performance, maintaining a healthy team environment, and assigning an **HR Follower** to support each member.\n- **Ideal Traits:** Good communication, active listening, objectivity, fairness, empathy, and follow-up skills."
      : "**لجنة الموارد البشرية (Human Resources - HR):**\n- **الدور والمهام:** إدارة الأفراد والتطوير الداخلي؛ مسؤولة عن مقابلات التقديم (Interviews)، متابعة وتقييم أداء الأعضاء، توفير بيئة عمل صحية، وتخصيص **HR Follower** لدعم كل عضو.\n- **المهارات المطلوبة:** التواصل الفعال، الاستماع الجيد، الموضوعية والحيادية، التعاطف، والقدرة على المتابعة وحل المشكلات.";
  }

  if (/(لجنه العلاقات العامه|لجنه ال pr|\bpr\b|public relations)/.test(norm)) {
    return isEn
      ? "**Public Relations Committee (PR - لجنة العلاقات العامة):**\n- **Role:** Official external representation — communicating with external institutions, speakers, and sponsors, building strategic partnerships, and securing sponsorships.\n- **Ideal Traits:** Strong negotiation and persuasion skills, confidence, formal communication etiquette, networking, and representing Alexanders professionally."
      : "**لجنة العلاقات العامة (Public Relations - PR):**\n- **الدور والمهام:** التمثيل الرسمي والتواصل الخارجي؛ مسؤولة عن التواصل مع الجهات والمؤسسات الخارجية والمتحدثين والرعاة، وبناء الشراكات الاستراتيجية، وتأمين الرعايات للكيان.\n- **المهارات المطلوبة:** مهارات التفاوض والإقناع، الثقة بالنفس، لباقة التواصل الرسمي، وبناء العلاقات (Networking).";
  }

  if (/(لجنه الميديا|لجنه الاعلام|\bmedia\b)/.test(norm)) {
    return isEn
      ? "**Media Committee (MD / ME - لجنة الميديا والإعلام):**\n- **Role:** Digital production, content creation, and visual identity covering events and managing online presence.\n- **4 Sub-tracks:**\n  1. **Graphic Design**\n  2. **Video Editing & Montage**\n  3. **Photography & Videography**\n  4. **Content Writing, Copywriting & Voiceover**"
      : "**لجنة الميديا والإعلام (Media Committee):**\n- **الدور والمهام:** الإنتاج الرقمي وصناعة المحتوى والهوية البصرية وتغطية الفعاليات.\n- **الأقسام الفرعية (4 تراكات):**\n  1. **التصميم الجرافيكي (Graphic Design)**\n  2. **المونتاج وتحرير الفيديو (Video Editing & Montage)**\n  3. **التصوير والتوثيق المرئي (Photography & Videography)**\n  4. **كتابة المحتوى والفويس أوفر (Content Writing & Voiceover)**";
  }

  if (/(اللجنه الفنيه|هاند ميد|handmade|art committee)/.test(norm)) {
    return isEn
      ? "**Art / Handmade Committee (اللجنة الفنية / الهاند ميد):**\n- **Role:** Environmental sustainability through creative arts, **Recycling**, **Upcycling**, eco-friendly projects, and designing/executing event decorations."
      : "**اللجنة الفنية / الهاند ميد (Art / Handmade Committee):**\n- **الدور والمهام:** ركيزة أساسية في هوية ألكساندرز البيئية؛ بتركز على الاستدامة البيئية، **إعادة التدوير (Recycling)**، **إعادة الاستخدام الإبداعي للخامات (Upcycling)**، تقليل المخلفات، وتصميم وتنفيذ ديكورات الفعاليات.";
  }

  if (/(لجنه البرمجه|البرمجه|programming)/.test(norm)) {
    return isEn
      ? "**Programming Committee (لجنة البرمجة):**\n- **Role:** Technical support and software/web development — building and maintaining websites, digital tools, platforms, and tech infrastructure for the entity and its events."
      : "**لجنة البرمجة (Programming Committee):**\n- **الدور والمهام:** الدعم التقني وتطوير البرمجيات والمواقع؛ مسؤولة عن بناء وتطوير المواقع الإلكترونية، الأدوات التقنية، والمنصات الرقمية الخاصة بالكيان وفعالياته.";
  }

  // All 6 committees
  if (/(لجان|committees)/.test(norm)) {
    return isEn
      ? "Alexanders operates through **6 integrated committees**:\n- **Organizing Committee (OC):** On-ground event management & logistics.\n- **Human Resources (HR):** Interviews, member tracking (HR Follower), & internal development.\n- **Public Relations (PR):** External partnerships, speakers, & sponsorships.\n- **Media (MD / ME):** Graphic Design, Video Editing & Montage, Photography/Videography, and Content Writing & Voiceover.\n- **Art / Handmade:** Recycling, Upcycling, eco-friendly projects, & event decor.\n- **Programming:** Technical support, websites, & digital solutions."
      : "كيان **ألكساندرز** بيشتغل من خلال **6 لجان أساسية**:\n- **لجنة التنظيم (OC):** الإدارة الميدانية واللوجستيات وتنفيذ الإيفنتات على أرض الواقع.\n- **لجنة الموارد البشرية (HR):** الانترفيوهات، متابعة وتقييم الأعضاء (HR Follower)، وتوفير بيئة عمل صحية.\n- **لجنة العلاقات العامة (PR):** التواصل الخارجي، عقد الشراكات، وتأمين الرعايات.\n- **لجنة الميديا (Media):** التصميم الجرافيكي، المونتاج، التصوير، وكتابة المحتوى والفويس أوفر.\n- **اللجنة الفنية / الهاند ميد (Art / Handmade):** الاستدامة البيئية، إعادة التدوير (Recycling & Upcycling)، وديكورات الفعاليات.\n- **لجنة البرمجة (Programming):** الدعم التقني وتطوير المواقع والحلول البرمجية.";
  }

  // How to apply
  if (/(ازاي اقدم|ازاي انضم|طريقه التقديم|فورم التقديم|how to apply|how do i join|application form)/.test(norm)) {
    return isEn
      ? `To join as a Committee Member:\n1. Fill out the form: [member_application_form](${MEMBER_FORM_URL})\n2. An HR team member will contact you via WhatsApp to schedule your interview time and location.\n3. Pass the committee interview to join as a Member!`
      : `خطوات الانضمام لعضوية اللجان في ألكساندرز:\n1. املا الفورم من هنا: [member_application_form](${MEMBER_FORM_URL})\n2. هيتواصل معاك مسؤول من لجنة الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو.\n3. بعد اجتياز المقابلة، بتنضم للجنة بصفة Member!`;
  }

  // Free activities & certificates
  if (/(مجانيه|مجاني|بفلوس|رسوم|شهادات|free|fees|certificates)/.test(norm)) {
    return isEn
      ? "Yes! **100% of our activities, trainings, courses, workshops, sessions, and trips are completely free.** Most trainings include accredited certificates, and field visits often include transportation allowances."
      : "أيوه، **100% من الأنشطة، الكورسات، التدريبات، الورش، السيشنز، والرحلات مجانية بالكامل** بدون أي رسوم! وكمان معظم التدريبات بتقدم شهادات معتمدة، وكتير من الزيارات الميدانية بيكون فيها بدلات انتقال.";
  }

  // Studies & attendance
  if (/(الدراسه|المذاكره|الكليه|حضور يومي|studies|attendance|exams)/.test(norm)) {
    return isEn
      ? "Not at all! We don't require constant daily presence on campus, and we fully respect university schedules, exams, and personal circumstances as long as you communicate with your assigned HR Follower."
      : "أبداً، الانضمام مش بيأثر على المذاكرة أو الكلية! الحضور مش يومي، وفيه مرونة وتفهم كامل لمواعيد الجامعة والامتحانات والظروف الشخصية طالما فيه التزام بالمهام وتواصل مع الـ **HR Follower** الخاص بك.";
  }

  // Past events & achievements
  if (/(ايفنتات|انجازات|فعاليات|العقول الخضراء|نادي اللغات|events|achievements|initiatives)/.test(norm)) {
    return isEn
      ? "**Key Alexanders Events, Programs & Achievements:**\n- **Green Minds League:** Environmental & critical-thinking competition with Bibliotheca Alexandrina across 14 faculties (Alexanders won **2nd Place** overall).\n- **Plastic-Free University Celebration:** Major World Environment Day event with the Ministry of Youth and Sports.\n- **Climate Change TOT:** 2-day Training of Trainers at the Faculty of Pharmacy with **ICESCO**.\n- **Green Leaders Program:** 3-day intensive training on green energy & green economy.\n- **Greenovate Hackathon & Freelancing Training:** In partnership with **Creativa Hub Alexandria (ITIDA/TIEC)**.\n- **Alexanders Language Club:** Practical speaking in **English, Turkish, and Chinese**.\n- **\"خلي المذاكرة لعبتك\" (1 & 2):** Exam-season study & time-management sessions."
      : "**أبرز إيفنتات ومبادرات وإنجازات كيان ألكساندرز:**\n- **دوري العقول الخضراء (Green Minds League):** أول مسابقة جامعية تجمع بين الوعي البيئي والتفكير النقدي بالتعاون مع مكتبة الإسكندرية بمشاركة 14 كلية (فاز فريق ألكساندرز **بالمركز الثاني**).\n- **احتفالية \"جامعة بلا بلاستيك\":** في اليوم العالمي للبيئة بمسرح المدينة الجامعية بالتعاون مع وزارة الشباب والرياضة.\n- **تدريب إعداد المدربين للمناخ (TOT):** بكلية الصيدلة بالتعاون مع منظمة **الإيسيسكو (ICESCO)**.\n- **برنامج قادة الأخضر (Green Leaders):** تدريب مكثف لمدة 3 أيام عن الطاقة الخضراء والاقتصاد الأخضر.\n- **هاكاثون Greenovate وتدريب العمل الحر (Freelancing):** بالتعاون مع **Creativa Hub Alexandria**.\n- **نادي اللغات (Language Club):** لممارسة المحادثة بـ 3 لغات (**الإنجليزية، التركية، والصينية**).\n- **سيشنز \"خلي المذاكرة لعبتك\" (1 و2):** لدعم الطلاب في تنظيم الوقت والمذاكرة فترة الامتحانات.";
  }

  // Partners
  if (/(شركاء|تعاونات|شراكات|partners|collaborations)/.test(norm)) {
    return isEn
      ? "**Key Partners & Collaborations:**\n- **Bibliotheca Alexandrina**\n- **Ministry of Youth and Sports**\n- **ICESCO**\n- **Arab Union for Sustainable Development and Environment**\n- **Our Earth Climate Foundation for Sustainable Development**\n- **Creativa Hub Alexandria (ITIDA / TIEC)**\n- **Anna Lindh Foundation & Green Opportunities Initiative** (EU-funded)\n- **Alexandria University Youth Entity & Tourism Lovers Group**"
      : "**أبرز شركاء وتعاونات كيان ألكساندرز:**\n- **مكتبة الإسكندرية (Bibliotheca Alexandrina)**\n- **وزارة الشباب والرياضة**\n- **منظمة الإيسيسكو (ICESCO)**\n- **الاتحاد العربي للتنمية المستدامة والبيئة**\n- **مؤسسة مناخ أرضنا للتنمية المستدامة**\n- **مراكز إبداع مصر الرقمية (Creativa Hub Alexandria - ITIDA / TIEC)**\n- **مؤسسة أنا ليندا ومبادرة فرص خضراء** (الممولة من الاتحاد الأوروبي)\n- **كيان شباب جامعة الإسكندرية وجماعة محبي السياحة**";
  }

  // Affiliation & Location
  if (/(تابع لمين|مكانه فين|مقر|اشراف|affiliation|location|supervises)/.test(norm)) {
    return isEn
      ? "**Official Affiliation, Supervision & Location:**\n- **Affiliation:** An official student entity under the **General Administration of Youth Welfare — Student Families Department** at **Alexandria University**.\n- **Patronage & Supervision:** Under the patronage of the University President (**Prof. Dr. Abdelaziz Konsowa**) and direct supervision of the Vice President for Education & Student Affairs (**Prof. Dr. Ahmed Adel Abdel Hakim**), with academic and administrative support from **Mr. Mohamed Fawzy**, **Prof. Dr. Hassan Abdeen**, **Prof. Dr. Amani El-Sawy**, and **Prof. Dr. Magdy Agamia**.\n- **Location:** Student Activities Complex — General Administration of Youth Welfare, Alexandria University."
      : "**التبعية الرسمية والإشراف والمقر:**\n- **التبعية القانونية:** كيان طلابي رسمي تابع **للإدارة العامة لرعاية الشباب - إدارة الأسر الطلابية بجامعة الإسكندرية**.\n- **الرعاية والإشراف:** تحت رعاية رئيس الجامعة (**أ.د/ عبد العزيز قنصوه**) وإشراف مباشر من نائب رئيس الجامعة لشئون التعليم والطلاب (**أ.د/ أحمد عادل عبد الحكيم**)، وبدعم إداري وأكاديمي من **أ. محمد فوزي**، **د. حسن عابدين**، **د. أماني الصاوي**، و **أ.د/ مجدي عجمية**.\n- **المقر:** مجمع الأنشطة الطلابية - الإدارة العامة لرعاية الشباب، جامعة الإسكندرية.";
  }

  // Social links
  if (/(صفحات|سوشيال|تواصل|فيسبوك|انستجرام|social media|links|contact|facebook|instagram)/.test(norm)) {
    return isEn
      ? `Official Alexanders Group channels:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\n- [our_linkedin](${LINKEDIN_URL})\n- [our_tiktok](${TIKTOK_URL})\n- [our_youtube](${YOUTUBE_URL})\n- [our_intro_video](${INTRO_VIDEO_URL})`
      : `الصفحات الرسمية لكيان ألكساندرز:\n- [our_facebook](${FB_URL})\n- [our_instagram](${IG_URL})\n- [our_linkedin](${LINKEDIN_URL})\n- [our_tiktok](${TIKTOK_URL})\n- [our_youtube](${YOUTUBE_URL})\n- [our_intro_video](${INTRO_VIDEO_URL})`;
  }

  // About Alexanders
  if (/(ايه هو|عرفني|نبذه|الكساندرز|الكسندرز|alexanders|who are you|about)/.test(norm)) {
    return isEn
      ? `**Alexanders Group** ("Together for a Sustainable Alexandria") is an official student entity under the General Administration of Youth Welfare (Student Families Department) at Alexandria University. More than just organizing events, our core mission is spreading **Sustainable Development** into real initiatives and bridging the gap between university life and the job market through free courses, workshops, events, and trips.`
      : `**جماعة أليكساندرز (Alexanders Group)** تحت شعار "معاً من أجل إسكندرية مستدامة" هو كيان طلابي رسمي تابع للإدارة العامة لرعاية الشباب (إدارة الأسر الطلابية) بجامعة الإسكندرية.\nألكساندرز مش مجرد نشاط طلابي بينظم إيفنتات عشوائية، هويته الأساسية هي نشر مفهوم **التنمية المستدامة** وتحويله لمبادرات ومشاريع عملية وأثر مجتمعي حقيقي، مع سد الفجوة بين الدراسة وسوق العمل بتدريبات وأنشطة مجانية 100%.`;
  }

  return null;
}
