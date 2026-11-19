const DEFAULT_KB_VERSION = "v3-default";

const DEFAULT_SECTIONS = {
  SEC_01: `[SEC_01] التعريف والهوية والتبعية:
- كيان "ألكساندرز" (ALEXANDERS) مش مجرد كيان طلابي بينظم إيفنتات وأنشطة، لكنه كيان هدفه الأساسي نشر مفهوم "التنمية المستدامة" (Sustainable Development) وتحويله لأنشطة ومبادرات وتأثير حقيقي في المجتمع.
- كيان طلابي رسمي تابع لإدارة جامعة الإسكندرية (الإدارة العامة لرعاية الشباب - إدارة الأسر الطلابية) تحت إشراف أ.د/ نائب رئيس الجامعة لشؤون التعليم والطلاب.`,

  SEC_02: `[SEC_02] الأنشطة والمميزات:
- تدريبات، كورسات، سيشنز، ندوات، مبادرات، وإيفنتات لتطوير المهارات (Soft & Hard Skills) وتجهيز الطلاب لسوق العمل مع تركيز أساسي على التنمية المستدامة والأثر المجتمعي، بالإضافة لرحلات وزيارات ميدانية.
- كل الأنشطة مجانية 100%، ومعظمها بشهادات معتمدة، وأحياناً بدلات انتقال للزيارات الميدانية.`,

  SEC_03: `[SEC_03] شروط الانضمام ونظام العضوية والتقديم:
- متاح حصرياً لـ: طلبة جامعة الإسكندرية وجامعة الإسكندرية الأهلية (أي كلية أو فرقة).
- غير متاح لـ: الخريجين، طلبة سنة الامتياز، أو طلبة المعاهد والجامعات الأخرى.
- أنواع العضوية (نوعان):
  1. Committee Members (أعضاء اللجان): الأعضاء اللي بيختاروا يكون لهم دور فعّال بالانضمام لإحدى اللجان. بيشاركوا في تنفيذ المهام والأنشطة وتنظيم الإيفنتات والرحلات والكورسات والورش، وليهم الأولوية دائماً في المشاركة في كل الأنشطة.
  2. General Members: الطلاب اللي حابين يكونوا جزء من عائلة Alexanders ويتابعوا أنشطتها ويشاركوا فيها بدون الانضمام للجان أو تحمل مسؤوليات تنظيمية. بتتاح لهم الفرصة في الأنشطة حسب الأماكن المتاحة وطبيعة كل نشاط (الأولوية لأعضاء اللجان).
- خطوات التقديم والانترفيو:
  1. الطالب يختار اللجنة اللي حابب ينضم لها ويملأ فورم التقديم.
  2. بعد ملء الفورم، فيه عضو من لجنة الـ HR بيتواصل مع الطالب على واتساب لتحديد ميعاد ومكان الانترفيو.
  3. بعد اجتياز المقابلة والقبول، بينضم للجنة بصفة Member.`,

  SEC_04: `[SEC_04] نظام الترقيات، الفرق بين العضو والبورد، وسياسة الـ HR:
- الفرق بين العضو (Member) والبورد (Board):
  - العضو (Member): بينضم للجنة عشان يتعلم ويشارك في تنفيذ المهام والأنشطة ضمن فريق اللجنة.
  - البورد (Board): هم القيادات المسؤولة عن إدارة الكيان واللجان (الهيدز والفايسز - Heads & Vices)، ودورهم التخطيط ووضع الأهداف وإدارة اللجان وتوجيه الأعضاء.
- نظام الترقيات التدريجي داخل اللجان (Committee Promotion System):
  1. Member: العضو المقبول في اللجنة بعد اجتياز المقابلة ويبدأ المشاركة في المهام والأنشطة.
  2. Active Member: ترقية يحصل عليها الـ Member بعد إثبات نشاطه والتزامه واستمراريته ومشاركته الفعّالة.
  3. Senior: عضو لديه خبرة أكبر يساعد الأعضاء الجدد ويوجههم ويتابع بعض المهام.
  4. Lead: مسؤول عن قيادة ومتابعة فريق أو جزء من العمل داخل اللجنة وتوزيع المهام والتأكد من تنفيذها.
  5. Leader: المسؤول عن قيادة اللجنة بالكامل والإشراف على أعضائها وخططها وأنشطتها.
- معايير الترقية: الترقيات ليست تلقائية أو مرتبطة بمدة زمنية ثابتة، بل تعتمد على الالتزام، الأداء، الاستمرارية، المشاركة، والقدرة على تحمل مسؤوليات أكبر حسب تقييم قيادة الكيان واحتياجاته.
- المتابعة والالتزام (HR Policy):
  - المطلوب: الجدية، الالتزام بالمواعيد والتاسكات، والتواصل السريع، مع مراعاة الكلية والامتحانات (الحضور مش يومي).
  - كل عضو معاه HR Follower بيتابعه ويساعده.
  - سياسة الإنذارات (3 Strikes): بحد أقصى 3 تحذيرات لتجاهل الـ HR، الغياب المتكرر بدون عذر، أو إهمال التاسكات؛ بعد التالت يتم الاستبعاد (Filtration) فوراً.
  - العضو المميز (VIP): يُكرم شهرياً وبياخد أولوية مطلقة وتسهيلات خاصة في كل ما يخص الكيان.`,

  SEC_05: `[SEC_05] هيكل ولجان الكيان (6 لجان):
1. لجنة التنظيم (OC): الإدارة الميدانية، التخطيط اللوجستي، وإدارة الفعاليات على أرض الواقع.
2. لجنة الموارد البشرية (HR): إدارة الأفراد، متابعة وتقييم الأعضاء، والتواصل مع المتقدمين وتحديد مقابلاتهم.
3. لجنة العلاقات العامة (PR): التمثيل الرسمي، التواصل الخارجي، عقد الشراكات، وتأمين الرعايات.
4. لجنة الميديا (Media): الإنتاج الرقمي، التوثيق المرئي، إدارة المحتوى، والتصميم الجرافيكي.
5. اللجنة الفنية (Art / Handmade): الإنتاج الفني، تصميم وتنفيذ ديكورات الأنشطة، وإعادة التدوير.
6. لجنة البرمجة (Programming): الدعم التقني، الحلول البرمجية، والبنية التحتية التكنولوجية للكيان.`,

  SEC_06: `[SEC_06] السوشيال ميديا والتواصل الرسمي:
- فيسبوك (Facebook): https://www.facebook.com/share/1HKtdgUo2Y/
- إنستجرام (Instagram): https://www.instagram.com/alexandersgroupp?cplk=OTVoNjFucG80YWd3
- لينكد إن (LinkedIn): https://www.linkedin.com/company/alexanders-group/
- تيك توك (TikTok): https://www.tiktok.com/@alexanders.groupp?_t=ZS-8w0G3h8ZYue&_r=1
- يوتيوب (YouTube): https://youtube.com/@alexandersgroup?si=k3B7DaCmbUiI3ybJ`,
};

const DEFAULT_INDEX = `SEC_01: التعريف، الهوية (التنمية المستدامة)، والتبعية لجامعة الإسكندرية
SEC_02: الأنشطة، الكورسات، والمميزات المجانية والشهادات
SEC_03: شروط الانضمام، أنواع العضوية (Committee vs General)، وخطوات التقديم وتواصل الـ HR واتساب للانترفيو
SEC_04: نظام الترقيات (Member لـ Leader)، الفرق بين العضو والبورد (Heads & Vices)، وسياسة الـ HR والإنذارات و VIP
SEC_05: هيكل ولجان الكيان الـ 6 (OC, HR, PR, Media, Art/Handmade, Programming)
SEC_06: روابط السوشيال ميديا والتواصل الرسمي (Facebook, Instagram, LinkedIn, TikTok, YouTube)`;

async function kvGetSafe(env, key, type = "text") {
  if (!env.CMS_KV || typeof env.CMS_KV.get !== "function") return null;
  try {
    return await env.CMS_KV.get(key, { type });
  } catch (err) {
    console.warn(`[KB] KV read failed for ${key}:`, err.message);
    return null;
  }
}

export async function getKbMetadata(env) {
  const [version, indexText, tempRaw] = await Promise.all([
    kvGetSafe(env, "KB_VERSION", "text"),
    kvGetSafe(env, "KB_INDEX", "text"),
    kvGetSafe(env, "TEMP_DATA", "json"),
  ]);

  let tempTitles = "";
  if (Array.isArray(tempRaw) && tempRaw.length > 0) {
    tempTitles = tempRaw.map((item, i) => `- [${i + 1}]${item.title || "إعلان"}`).join("\n");
  } else if (typeof tempRaw === "string" && tempRaw.trim()) {
    tempTitles = "- إعلانات وتحديثات نشطة متاحة";
  }

  return {
    version: (version || DEFAULT_KB_VERSION).trim(),
    indexText: (indexText || DEFAULT_INDEX).trim(),
    tempTitles,
  };
}

export async function getSelectedSections(env, sectionIds = []) {
  const validIds = Array.isArray(sectionIds) ? sectionIds.slice(0, 3) : [];
  if (validIds.length === 0) return "";

  const kvSections = await kvGetSafe(env, "KB_SECTIONS", "json");
  const sectionsMap = kvSections && typeof kvSections === "object" ? kvSections : DEFAULT_SECTIONS;

  return validIds
    .map((id) => sectionsMap[id])
    .filter(Boolean)
    .join("\n\n");
}

export async function getTempData(env) {
  const tempRaw = await kvGetSafe(env, "TEMP_DATA", "json");
  if (!tempRaw) return "";

  if (Array.isArray(tempRaw)) {
    return tempRaw
      .map((item) => `- ${item.title || "تحديث"}: ${item.details || ""}`)
      .join("\n");
  }

  return typeof tempRaw === "string" ? tempRaw.trim() : JSON.stringify(tempRaw);
}

