const DEFAULT_KB_VERSION = "v4-default";

const DEFAULT_SECTIONS = {
  SEC_01: `[SEC_01] التعريف والهوية والتبعية الرسمية، الشعار، إدارة جامعة الإسكندرية، الشخصيات الداعمة، والموقع (About Alexanders, Identity, Affiliation, Officials & Location):
- الاسم الرسمي: Alexanders Group (جماعة أليكساندرز / كيان Alexanders).
- الشعار (Slogan): "معاً من أجل إسكندرية مستدامة" (Together for a Sustainable Alexandria).
- الهوية والتموضع الأساسي: Alexanders مش مجرد نشاط طلابي بينظم إيفنتات عشوائية؛ هويته الأساسية ومهمته الرئيسية هي نشر مفهوم التنمية المستدامة (Sustainable Development) وتحويله إلى مبادرات حقيقية ومشاريع عملية وأثر مجتمعي ملموس.
- التبعية الرسمية والوضع القانوني: كيان طلابي رسمي يعمل تحت مظلة الإدارة العامة لرعاية الشباب - إدارة الأسر الطلابية بجامعة الإسكندرية (General Administration of Youth Welfare — Student Families Department at Alexandria University).
- الإشراف والرعاية الرسمية: تحت الإشراف المباشر للأستاذ الدكتور/ أحمد عادل عبد الحكيم نائب رئيس جامعة الإسكندرية لشئون التعليم والطلاب، وتحت رعاية الأستاذ الدكتور/ عبد العزيز قنصوه رئيس جامعة الإسكندرية.
- الشخصيات الداعمة أكاديمياً وإدارياً: الأستاذ/ محمد فوزي (مدير إدارة الأسر الطلابية - Mr. Mohamed Fawzy)، الأستاذ الدكتور/ حسن عابدين (عميد كلية التربية - Prof. Dr. Hassan Abdeen)، الدكتورة/ أماني الصاوي (رئيس قسم اللغة الإنجليزية - Prof. Dr. Amani El-Sawy)، والأستاذ الدكتور/ مجدي عجمية (رئيس قسم اللغات الشرقية - Prof. Dr. Magdy Agamia).
- المقر والموقع: جامعة الإسكندرية - الإدارة العامة لرعاية الشباب - مجمع الأنشطة الطلابية (Alexandria University Student Activities Complex).`,

  SEC_02: `[SEC_02] الرؤية، الرسالة، التنمية المستدامة، الأنشطة، الكورسات، المميزات المجانية، الشهادات، وبدلات الانتقال (Vision, Mission, SDGs, Free Activities, Certificates & Benefits):
- الهدف الرئيسي: نشر الوعي بأهداف التنمية المستدامة (SDGs / Sustainable Development Goals) وتحويلها إلى مبادرات طلابية قابلة للتنفيذ ومشاريع بيئية وأثر مجتمعي حقيقي.
- سد الفجوة: سد الفجوة بين الدراسة الأكاديمية وسوق العمل الحقيقي (Bridging the gap between academic study and the labor market) عبر تزويد الطلاب بمهارات عملية وتقنية وشخصية.
- مميزات وفوائد الانضمام للطلاب:
  - أنشطة مجانية 100%: جميع الإيفنتات، الكورسات، الورش، البرامج التدريبية، السيشنز، والرحلات مجانية بالكامل بدون أي رسوم.
  - شهادات معتمدة وبدلات انتقال: توفير شهادات معتمدة (Accredited certificates) لمعظم التدريبات والفعاليات، مع توفير بدلات انتقال (Transportation allowances) في كثير من الزيارات الميدانية والبرامج الرسمية.
  - تطوير المهارات: خبرة عملية في المهارات الشخصية Soft Skills (القيادة، العمل الجماعي، التفاوض، إدارة الوقت) والمهارات التقنية Hard Skills (البرمجة، الإنتاج الإعلامي، إدارة الفعاليات، إعادة التدوير والأعمال اليدوية Upcycling/Handicrafts، واللغات).
  - بيئة داعمة ومرنة: تفهم ومرونة كاملة لمواعيد الجامعة، الامتحانات، والظروف الشخصية؛ لا يُشترط التواجد المستمر في الحرم الجامعي، والأهم هو الالتزام بالمهام المطلوبة والتواصل.`,

  SEC_03: `[SEC_03] شروط الانضمام، الفئات المؤهلة، أنواع العضوية، خطوات التقديم، تواصل الـ HR واتساب للانترفيو، وفورم التقديم كعضو (Eligibility, Committee vs General Membership, Interview & Member Application Form):
- الفئات المؤهلة للانضمام (Eligibility): متاح حصرياً لطلاب المرحلة الجامعية (Undergraduate students) المقيدين بأي كلية أو فرقة دراسية في جامعة الإسكندرية (Alexandria University) أو جامعة الإسكندرية الأهلية (Alexandria National University).
- الفئات غير المؤهلة: غير متاح للخريجين، طلبة سنة الامتياز، طلاب المعاهد، أو طلاب الجامعات الأخرى.
- أنواع العضوية (Membership Types):
  - أعضاء اللجان (Committee Members): الطلاب الذين يختارون دوراً تنفيذياً فعّالاً بالانضمام لإحدى اللجان الـ 6؛ يشاركون في تخطيط وتنفيذ الفعاليات والكورسات والورش والرحلات، ولهم دائماً الأولوية المطلقة (Top priority) في حضور جميع الإيفنتات والرحلات والكورسات والورش.
  - الأعضاء العامون (General Members): الطلاب الراغبون في الانتماء لمجتمع Alexanders وحضور الأنشطة بدون الانضمام للجنة معينة أو تحمل مسؤوليات تنظيمية؛ تتاح لهم فرصة حضور الفعاليات والرحلات والكورسات والورش حسب الأماكن المتاحة وطبيعة كل نشاط بعد إعطاء الأولوية لأعضاء اللجان النشطين.
- خطوات التقديم والانترفيو: املأ فورم التقديم كعضو <- يتواصل معك أحد مسؤولي لجنة الـ HR على واتساب لتحديد ميعاد ومكان الانترفيو <- اجتز مقابلة اللجنة <- انضم بصفة Member.
- مواعيد التقديم والانترفيو: يتم الإعلان عن مواعيد التقديم والانترفيوهات والفعاليات بشكل ديناميكي على صفحات السوشيال ميديا الرسمية (Facebook و Instagram)، أو يتم إبلاغ المتقدم بها عبر واتساب من الـ HR بعد ملء الفورم.
- رابط فورم التقديم كعضو لجنة (Member Application Form — يُشارك عند السؤال عن التقديم أو الانضمام كعضو): https://docs.google.com/forms/d/1yOGYtx0LASRlMGKZOo1QNpyxHvQASdMMXPAswzITfXg/viewform`,

  SEC_04: `[SEC_04] الفرق بين العضو والبورد، قيادة الكيان، نظام الترقيات داخل اللجان، سياسة الـ HR والإنذارات، العضو المميز VIP، وفورم التقديم للبورد (Board vs Members, Promotion Ladder, HR Policy, 3-Strikes, VIP & Board Application Form):
- الفرق بين العضو والبورد (Members vs. The Board):
  - أعضاء اللجان (Committee Members): العمود الفقري التشغيلي للكيان، ينفذون المهام وينظمون الأنشطة ويساهمون داخل لجانهم.
  - البورد (The Board - قيادة الكيان واللجان): يتكون من رئيس الكيان (Entity President)، ونواب الرئيس (Vice Presidents)، ورؤساء ونواب رؤساء اللجان (Committee Heads & Vice Heads). مسؤول عن التخطيط الاستراتيجي، إدارة الفرق، اتخاذ القرارات، الإشراف على اللجان، وضمان تحقيق أهداف الكيان.
- رابط فورم التقديم للبورد (Board Application Form — يُشارك فقط عند السؤال عن التقديم للبورد أو الأدوار القيادية): https://docs.google.com/forms/d/e/1FAIpQLScY4IYRtpvghlAck38xeE72-Eyg6BYa17IwbbsurNm_XRSfmA/viewform
- ملاحظة التقديم للبورد: بعد ملء فورم البورد، يتواصل ممثل الـ HR مع المتقدم عبر واتساب لترتيب ميعاد وتوقيت ومكان المقابلة.
- نظام الترقيات داخل اللجان (Committee Promotion Ladder): الترقيات ليست تلقائية ولا ترتبط بمدة زمنية ثابتة، بل تُكتسب بناءً على الالتزام، الأداء، الاستمرارية، والقدرة على تحمل المسؤولية حسب تقييم القيادة واحتياجات الكيان:
  - 1. Member: عضو لجنة مقبول حديثاً بعد اجتياز المقابلة.
  - 2. Active Member: يُرقى بعد إثبات نشاط مستمر والتزام ومساهمة فعّالة في مهام اللجنة.
  - 3. Senior: عضو ذو خبرة قادر على توجيه وإرشاد الأعضاء الجدد ومتابعة المهام.
  - 4. Vice Head (Lead): يساعد في قيادة والإشراف على فريق فرعي أو جزء من عمليات اللجنة وتوزيع المهام وضمان التنفيذ.
  - 5. Head (Leader): يقود اللجنة بالكامل، يشرف على جميع الأعضاء، يضع الخطط، ويضمن تحقيق أهداف اللجنة.
- نظام المتابعة وسياسة الـ HR والتكريم:
  - نظام HR Follower: لكل عضو في اللجنة "HR Follower" مخصص يتابعه خطوة بخطوة ويدعمه ويساعده في حل أي عقبات أثناء الموازنة بين الدراسة والعمل في الكيان.
  - سياسة الإنذارات الثلاثة (3-Strikes Warning Policy): يحصل العضو على حد أقصى 3 تحذيرات (Strikes) في حال تجاهل الـ HR Follower ("كرف")، أو الغياب المتكرر عن الاجتماعات والفعاليات بدون عذر مقبول، أو إهمال المهام الموكلة بدون تواصل؛ وعند تلقي الإنذار الثالث يتم استبعاد العضو فوراً (Filtration) من اللجنة. تُقدَّر وتُراعى دائماً الأعذار القهرية مثل الامتحانات وضغط الدراسة أو الطوارئ الشخصية بشرط التواصل المسبق مع الـ HR Follower.
  - عضو الشهر المميز (Member of the Month - VIP): يتم تكريم العضو الأكثر نشاطاً واجتهاداً شهرياً علناً أمام الكيان بالكامل، ويحصل على أولوية VIP وتسهيلات خاصة في جميع أنشطة Alexanders.`,

  SEC_05: `[SEC_05] الهيكل التنظيمي ولجان الكيان الـ 6، التخصصات، تراك الميديا، الهاند ميد وإعادة التدوير، ومؤهلات كل لجنة (6 Committees: OC, HR, PR, Media, Art/Handmade, Programming & Ideal Qualifications):
- يعمل كيان Alexanders من خلال 6 لجان متكاملة:
- 1. لجنة التنظيم (Organizing Committee - OC):
  - الدور: الإدارة الميدانية واللوجستيات؛ مسؤولة عن تخطيط وتنظيم وتنفيذ الإيفنتات والمؤتمرات والرحلات على أرض الواقع، والحفاظ على النظام، والتعامل بهدوء وسرعة مع أي مشكلات مفاجئة في الموقع.
  - المؤهلات والسمات المطلوبة: مهارات تنظيم قوية، سرعة حل المشكلات، القدرة على العمل تحت ضغط، روح الفريق، وطاقة عالية في العمل الميداني.
- 2. لجنة الموارد البشرية (Human Resources Committee - HR):
  - الدور: إدارة الأفراد والتطوير الداخلي؛ مسؤولة عن التوظيف وإجراء المقابلات (interviews)، متابعة وتقييم أداء الأعضاء، ضمان بيئة عمل صحية، وتخصيص "HR Follower" لدعم كل عضو، والتواصل مع المتقدمين عبر واتساب لتحديد المقابلات.
  - المؤهلات والسمات المطلوبة: مهارات تواصل واستماع فعّال جيدة، الموضوعية، الإنصاف، التعاطف، والقدرة على المتابعة وحل مشكلات الفريق.
- 3. لجنة العلاقات العامة (Public Relations Committee - PR):
  - الدور: التمثيل الرسمي والتواصل الخارجي؛ مسؤولة عن التواصل مع الجهات الخارجية والمؤسسات والمتحدثين والرعاة، وبناء شراكات استراتيجية، وتأمين الرعايات (Sponsorships) للكيان.
  - المؤهلات والسمات المطلوبة: مهارات تفاوض وإقناع عالية، ثقة بالنفس، إتيكيت التواصل الرسمي، القدرة على بناء العلاقات (Networking)، والتمثيل القوي لصورة الكيان.
- 4. لجنة الميديا والإعلام (Media Committee - MD / ME):
  - الدور: الإنتاج الرقمي وصناعة المحتوى والهوية البصرية؛ حلقة الوصل بين الكيان والمجتمع عبر تغطية الفعاليات وإدارة التواجد الرقمي.
  - التراكات والفرق الفرعية داخل الميديا: التصميم الجرافيكي (Graphic Design)، المونتاج وتحرير الفيديو (Video Editing & Montage)، التصوير الفوتوغرافي والفيديو والتوثيق المرئي (Photography & Videography)، وكتابة المحتوى والإعلانات والتعليق الصوتي (Content Writing, Copywriting & Voiceover).
  - المؤهلات والسمات المطلوبة: الإبداع، الحس البصري، معرفة أساسية أو متوسطة بأدوات التصميم أو المونتاج أو التصوير، أو مهارات قوية في الكتابة الإبداعية وسرد القصص (Storytelling).
- 5. اللجنة الفنية / الهاند ميد (Art / Handmade Committee):
  - الدور: الاستدامة البيئية عبر الفنون الإبداعية وإعادة التدوير وديكورات الفعاليات.
  - التركيز الأساسي: لا تقتصر على الأشغال اليدوية التقليدية، بل تلعب دوراً محورياً في هوية Alexanders من خلال نشر الوعي البيئي، إعادة التدوير (Recycling)، إعادة الاستخدام الإبداعي للخامات (Upcycling)، تقليل الهدر، ابتكار مشاريع صديقة للبيئة، وتصميم وتنفيذ ديكورات الفعاليات.
  - المؤهلات والسمات المطلوبة: شغف بالأشغال اليدوية، الإبداع، الاهتمام بالاستدامة البيئية وإعادة التدوير، والاهتمام بالتفاصيل الفنية.
- 6. لجنة البرمجة (Programming Committee):
  - الدور: الدعم التقني وتطوير البرمجيات والويب؛ مسؤولة عن بناء وصيانة المواقع الإلكترونية، الأدوات التقنية، المنصات الرقمية، والبنية التحتية التكنولوجية للكيان وفعالياته.
  - المؤهلات والسمات المطلوبة: شغف أو خلفية في تطوير الويب، لغات البرمجة، حل المشكلات، أو بناء الحلول التقنية (مفتوحة للمتعلمين والمطورين الطلاب ذوي الخبرة على حد سواء).`,

  SEC_06: `[SEC_06] روابط السوشيال ميديا، الصفحات الرسمية، التواصل، والفيديو التعريفي (Official Social Media Links: Facebook, Instagram, LinkedIn, TikTok, YouTube & Intro Video):
- الفيديو التعريفي للكيان (Introductory Video): https://vt.tiktok.com/ZSbpsEYrs/
- صفحة فيسبوك (Facebook): https://www.facebook.com/share/1HKtdgUo2Y/
- حساب إنستجرام (Instagram): https://www.instagram.com/alexandersgroupp?cplk=OTVoNjFucG80YWd3
- صفحة لينكد إن (LinkedIn): https://www.linkedin.com/company/alexanders-group/
- حساب تيك توك (TikTok): https://www.tiktok.com/@alexanders.groupp?_t=ZS-8w0G3h8ZYue&_r=1
- قناة يوتيوب (YouTube): https://youtube.com/@alexandersgroup?si=k3B7DaCmbUiI3ybJ`,

  SEC_07: `[SEC_07] أبرز الأنشطة والإنجازات السابقة، احتفالية جامعة بلا بلاستيك، دوري العقول الخضراء، قادة الأخضر، TOT التغير المناخي، هاكاثون Greenovate، الفريلانسنج، تنظيف الشاطئ، نادي اللغات، خلي المذاكرة لعبتك، والرحلات (Past Events, Track Record, Competitions & Initiatives):
- 1. احتفالية "جامعة بلا بلاستيك" (Plastic-Free University Celebration): فعالية ضخمة في اليوم العالمي للبيئة بمسرح المدينة الجامعية (University Dormitory Theater) بالتعاون مع الاتحاد العربي للتنمية المستدامة والبيئة ووزارة الشباب والرياضة.
- 2. دوري العقول الخضراء (Green Minds League): أول مسابقة جامعية تجمع بين الوعي البيئي والتفكير النقدي بالشراكة مع مكتبة الإسكندرية (Bibliotheca Alexandrina)؛ تنافس فيها 14 فريقاً من كليات جامعة الإسكندرية إلى جانب مكتبة الإسكندرية وألكساندرز، وفاز فريق Alexanders بالمركز الثاني (2nd Place overall).
- 3. برنامج قادة الأخضر (Green Leaders Program): برنامج تدريبي مكثف لمدة 3 أيام في الإدارة العامة لرعاية الشباب تناول الطاقة الخضراء وتطبيقات الاقتصاد الأخضر وتوظيف الفن والإبداع لتوصيل الرسائل البيئية، تلاه تطبيق عملي داخل كليات الجامعة.
- 4. تدريب مدربين التغير المناخي (Climate Change TOT): تدريب مدربين متخصص في التغير المناخي لمدة يومين بكلية الصيدلة ضمن المبادرة الوطنية "جامعات خضراء لمستقبل أفضل"، بتنظيم مؤسسة مناخ أرضنا للتنمية المستدامة وبالتعاون مع منظمة الإيسيسكو (ICESCO).
- 5. المعرض العربي للاستدامة (Arab Sustainability Expo): مشاركة رسمية في فندق Triumph Luxury Hotel (التجمع الخامس، القاهرة) بناءً على دعوة رسمية من مكتبة الإسكندرية لتبادل الخبرات حول الحلول البيئية المبتكرة.
- 6. هاكاثون Greenovate (Greenovate Hackathon): شريك رسمي في الهاكاثون الذي استضافته مراكز إبداع مصر الرقمية Creativa Hub Alexandria (ITIDA / TIEC) لتمكين الشباب واحتضان الأفكار الخضراء المبتكرة.
- 7. تدريب التخصص المهني والعمل الحر (Freelancing Career Specialization Training): أول مشروع مشترك بين Alexanders و Creativa Hub Alexandria لتقديم تدريب عملي على الفريلانسنج وأدوات المسار المهني للطلاب.
- 8. مبادرة "معاً لبيئة بلا مخلفات" لتنظيف الشواطئ (Beach Cleanup Initiative): حملة تنظيف شاطئ سيد درويش بالأنفوشي بمشاركة أكثر من 100 طالب بالتعاون مع كيان شباب جامعة الإسكندرية وجماعة محبي السياحة.
- 9. نادي لغات ألكساندرز (Alexanders Language Club): نادي تفاعلي يركز على الممارسة العملية للمحادثة وكسر حاجز الخوف في 3 لغات: الإنجليزية (English)، التركية (Turkish)، والصينية (Chinese)، ويشمل اختبارات تحديد مستوى وإشرافاً أكاديمياً.
- 10. جلسات الدعم الطلابي "خلي المذاكرة لعبتك" 1 و 2 ("خلي المذاكرة لعبتك" Student Support Sessions): سيشنز أونلاين تُطلق خلال فترات الامتحانات النهائية للتركيز على إدارة الوقت والتعامل مع توتر الامتحانات وأساليب المذاكرة العلمية.
- 11. الرحلات الثقافية والميدانية والتعريفية: جولة ثقافية في متحف قسطنطين كفافيس (Cavafy Museum) بالإسكندرية، زيارة وفد طلابي منظم لمعرض القاهرة الدولي للكتاب (Cairo International Book Fair)، بالإضافة لفعاليات تعريفية ميدانية شاملة في جامعة الإسكندرية للتعريف بالكيان ولجانه.`,

  SEC_08: `[SEC_08] الشركاء والتعاونات الرسمية: مكتبة الإسكندرية، وزارة الشباب والرياضة، الإيسيسكو، كرياتيفا، مؤسسة أنا ليندا، والاتحاد الأوروبي (Key Partners & Collaborations):
- مكتبة الإسكندرية (Bibliotheca Alexandrina)
- وزارة الشباب والرياضة (Ministry of Youth and Sports)
- الاتحاد العربي للتنمية المستدامة والبيئة (Arab Union for Sustainable Development and Environment)
- منظمة الإيسيسكو — منظمة العالم الإسلامي للتربية والعلوم والثقافة (ICESCO — Islamic World Educational, Scientific and Cultural Organization)
- مؤسسة مناخ أرضنا للتنمية المستدامة (Our Earth Climate Foundation for Sustainable Development)
- مراكز إبداع مصر الرقمية بالإسكندرية — إيتيدا / تيك (Creativa Hub Alexandria — ITIDA / TIEC)
- مؤسسة أنا ليندا (Anna Lindh Foundation) ومبادرة فرص خضراء (Green Opportunities Initiative) بتمويل من الاتحاد الأوروبي (Funded by the European Union)
- كيان شباب جامعة الإسكندرية (Alexandria University Youth Entity) وجماعة محبي السياحة (Tourism Lovers Group)`,
};

const DEFAULT_INDEX = `SEC_01: التعريف والهوية والتبعية الرسمية، الشعار، إدارة جامعة الإسكندرية، الشخصيات الداعمة، والموقع (About Alexanders, Identity, Affiliation, Officials & Location)
SEC_02: الرؤية، الرسالة، التنمية المستدامة، الأنشطة، الكورسات، المميزات المجانية، الشهادات، وبدلات الانتقال (Vision, Mission, SDGs, Free Activities, Certificates & Benefits)
SEC_03: شروط الانضمام، الفئات المؤهلة، أنواع العضوية، خطوات التقديم، تواصل الـ HR واتساب للانترفيو، وفورم التقديم كعضو (Eligibility, Committee vs General Membership, Interview & Member Application Form)
SEC_04: الفرق بين العضو والبورد، قيادة الكيان، نظام الترقيات داخل اللجان، سياسة الـ HR والإنذارات، العضو المميز VIP، وفورم التقديم للبورد (Board vs Members, Promotion Ladder, HR Policy, 3-Strikes, VIP & Board Application Form)
SEC_05: الهيكل التنظيمي ولجان الكيان الـ 6، التخصصات، تراك الميديا، الهاند ميد وإعادة التدوير، ومؤهلات كل لجنة (6 Committees: OC, HR, PR, Media, Art/Handmade, Programming & Ideal Qualifications)
SEC_06: روابط السوشيال ميديا، الصفحات الرسمية، التواصل، والفيديو التعريفي (Official Social Media Links: Facebook, Instagram, LinkedIn, TikTok, YouTube & Intro Video)
SEC_07: أبرز الأنشطة والإنجازات السابقة، احتفالية جامعة بلا بلاستيك، دوري العقول الخضراء، قادة الأخضر، TOT التغير المناخي، هاكاثون Greenovate، الفريلانسنج، تنظيف الشاطئ، نادي اللغات، خلي المذاكرة لعبتك، والرحلات (Past Events, Track Record, Competitions & Initiatives)
SEC_08: الشركاء والتعاونات الرسمية: مكتبة الإسكندرية، وزارة الشباب والرياضة، الإيسيسكو، كرياتيفا، مؤسسة أنا ليندا، والاتحاد الأوروبي (Key Partners & Collaborations)`;

async function kvGetSafe(env, key, type = "text") {
  if (!env.CMS_KV || typeof env.CMS_KV.get !== "function") return null;
  try {
    return await env.CMS_KV.get(key, { type });
  } catch (err) {
    console.warn(`[KB] KV read failed for ${key}:`, err.message);
    return null;
  }
}

async function kvGetTempSafe(env) {
  const raw = await kvGetSafe(env, "TEMP_DATA", "text");
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw.trim();
  }
}

export async function getKbMetadata(env) {
  const [version, indexText, tempRaw] = await Promise.all([
    kvGetSafe(env, "KB_VERSION", "text"),
    kvGetSafe(env, "KB_INDEX", "text"),
    kvGetTempSafe(env),
  ]);

  let tempTitles = "";
  if (Array.isArray(tempRaw) && tempRaw.length > 0) {
    tempTitles = tempRaw.map((item, i) => `- [${i + 1}]${item.title || "إعلان"}`).join("\n");
  } else if (typeof tempRaw === "string" && tempRaw.trim()) {
    tempTitles = "- إعلانات وتحديثات نشطة متاحة";
  } else if (tempRaw && typeof tempRaw === "object") {
    tempTitles = `- ${tempRaw.title || "إعلانات وتحديثات نشطة متاحة"}`;
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
  const tempRaw = await kvGetTempSafe(env);
  if (!tempRaw) return "";

  if (Array.isArray(tempRaw)) {
    return tempRaw
      .map((item) => `- ${item.title || "تحديث"}: ${item.details || ""}`)
      .join("\n");
  }

  return typeof tempRaw === "string" ? tempRaw.trim() : JSON.stringify(tempRaw);
}
