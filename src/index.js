const EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";
const CHAT_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const BOT_NAME = "DreamShift AI";
const KB_VERSION = "dreamshift-australia-v1.1";

const DIRECT_FALLBACK =
  "I’m not aware of that at the moment. Please contact us via WhatsApp for direct support.";

const jsonHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,x-ingest-key,x-admin-key,authorization",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

const ok = (body, moreHeaders = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...jsonHeaders, ...moreHeaders },
  });

const err = (message, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: jsonHeaders,
  });

// ---------------------------------------------------------------------------
// Critical business facts
// ---------------------------------------------------------------------------

const PACKAGE_FACTS = {
  essential: {
    name: "Essential Package",
    price: "AUD 750",
    ideal: "best if you have one specific job opening to apply for",
    includes: [
      "Resume/CV Writing: 1 version",
      "Cover Letter Writing: 1 version",
      "Basic LinkedIn Optimization",
      "ATS Keyword Research",
      "2 consultation calls",
      "1 month ongoing support",
      "unlimited revisions within 1 week",
    ],
  },
  advanced: {
    name: "Advanced Package",
    price: "AUD 800",
    ideal: "best if you want experts to handle every document and guide you through the job search",
    includes: [
      "Resume/CV Writing: 3–4 versions",
      "Cover Letter Writing: 3–4 versions",
      "Advanced LinkedIn Optimization",
      "LinkedIn Banner + Free Designs",
      "ATS Keyword Research",
      "unlimited consultation calls",
      "Job Search Strategy: 50+ jobs in 10 hours",
      "Interview Preparation Guide for each interview",
      "ongoing support until you land a job",
      "unlimited revisions within 1 month",
    ],
  },
  ultimate: {
    name: "Ultimate Career Package",
    price: "AUD 1500",
    ideal: "best if you want DreamShift to apply for jobs and handle everything for you",
    includes: [
      "Resume/CV Writing: 3–4 versions",
      "Cover Letter Writing: 3–4 versions",
      "Advanced LinkedIn Optimization",
      "LinkedIn Banner + Free Designs",
      "ATS Keyword Research",
      "unlimited consultation calls",
      "Job Search Strategy: 50+ jobs in 10 hours",
      "Interview Preparation Guide for each interview",
      "2 months of Job Application Support",
      "Dedicated Senior Writer",
      "ongoing support until you land a job",
      "unlimited revisions within 1 month",
    ],
  },
};

const INDIVIDUAL_SERVICES = [
  "Resume/CV Writing: AUD 400 onwards",
  "Cover Letter Writing: AUD 150 onwards",
  "LinkedIn Optimization: AUD 350 onwards",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(input) {
  return (input || "")
    .toString()
    .toLowerCase()
    .replace(/[^\w\s$+%.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function makeId(prefix = "id") {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}

function boolInt(value) {
  return value ? 1 : 0;
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return null;
  }
}

function getDb(env) {
  return env.DB || env.dreamshift_ai_db || null;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pct(part, total) {
  const p = num(part);
  const t = num(total);

  if (!t) return 0;

  return Math.round((p / t) * 100);
}

function chunkText(text, max = 1200, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(text.length, start + max);
    const chunk = text.slice(start, end).trim();

    if (chunk) chunks.push(chunk);
    if (end === text.length) break;

    start = Math.max(0, end - overlap);
  }

  return chunks;
}

function normalizeEmbedding(res) {
  if (!res) return null;

  if (Array.isArray(res) && typeof res[0] === "number") return res;

  if (Array.isArray(res?.data)) {
    const first = res.data[0];
    if (Array.isArray(first)) return first;
    if (Array.isArray(first?.embedding)) return first.embedding;
  }

  if (Array.isArray(res?.embedding)) return res.embedding;
  if (Array.isArray(res?.vector)) return res.vector;

  return null;
}

function makeShortVectorId(file, chunkIndex) {
  const safeFile = file
    .replace(/\.md$/i, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toLowerCase();

  const shortUuid = crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  return `${safeFile}-${chunkIndex}-${shortUuid}`;
}

function inferCategoryFromFile(file) {
  const f = file.toLowerCase();

  if (f.includes("critical")) return "critical_facts";
  if (f.includes("brand") || f.includes("chatbot")) return "brand_rules";
  if (f.includes("service")) return "services";
  if (f.includes("package") || f.includes("pricing")) return "pricing";
  if (f.includes("guarantee") || f.includes("refund") || f.includes("revision")) return "guarantee_policy";
  if (f.includes("process")) return "process";
  if (f.includes("australia")) return "australia_guidance";
  if (f.includes("industries") || f.includes("proof")) return "proof";
  if (f.includes("faq")) return "faq";
  if (f.includes("objection")) return "sales_objections";
  if (f.includes("qualification") || f.includes("handoff")) return "lead_qualification";
  if (f.includes("dashboard") || f.includes("tags")) return "analytics_tags";

  return "general";
}

function cleanReply(reply) {
  if (!reply || typeof reply !== "string") return DIRECT_FALLBACK;

  let cleaned = reply.trim();

  const badOpenings = [
    "Based on the provided knowledge base passages,",
    "Based on the provided knowledge base,",
    "Based on the knowledge base passages,",
    "According to the provided knowledge base,",
    "According to the knowledge base,",
  ];

  for (const opening of badOpenings) {
    if (cleaned.toLowerCase().startsWith(opening.toLowerCase())) {
      cleaned = cleaned.slice(opening.length).trim();
    }
  }

  cleaned = cleaned
    .replace(/^User message:\s*/gim, "")
    .replace(/^Safe reply:\s*/gim, "")
    .replace(/^Recommended action:\s*/gim, "")
    .replace(/^Important rule:\s*/gim, "")
    .replace(/^Objection:\s*/gim, "")
    .replace(/^Source:\s*/gim, "")
    .replace(/^Answer:\s*/gim, "")
    .trim();

  return cleaned || DIRECT_FALLBACK;
}

function listIncludes(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function packageSummary(pkg) {
  return `**${pkg.name} — ${pkg.price}**\nIdeal: ${pkg.ideal}.\nIncludes:\n${listIncludes(pkg.includes)}`;
}

// ---------------------------------------------------------------------------
// Intent detection
// ---------------------------------------------------------------------------

function classifyIntent(message) {
  const m = normalizeText(message);

  if (
    m.includes("what packages do you offer") ||
    m.includes("what packages") ||
    m.includes("packages do you offer") ||
    m.includes("what are your packages") ||
    m.includes("show me your packages") ||
    m.includes("list your packages") ||
    m.includes("package list") ||
    m.includes("packages available") ||
    m.includes("plans available") ||
    (hasAny(m, ["packages", "plans"]) && hasAny(m, ["offer", "available", "list", "show"]))
  ) {
    return "packages_overview";
  }

  if (
    hasAny(m, ["missed my call", "missed the call", "missed consultation", "reschedule"]) &&
    hasAny(m, ["call", "consultation", "appointment", "meeting"])
  ) {
    return "missed_call_reschedule";
  }

  if (
    hasAny(m, ["urgent", "tomorrow", "today", "asap", "quickly", "deadline", "fast", "soon"]) ||
    m.includes("24 hour") ||
    m.includes("48 hour")
  ) {
    return "urgent_delivery";
  }

  if (
    hasAny(m, ["apply for jobs for me", "apply on my behalf", "apply behalf", "job application support"]) ||
    (hasAny(m, ["apply", "applications"]) &&
      hasAny(m, ["for me", "behalf", "handle", "done for me", "support"]))
  ) {
    return "job_application_support";
  }

  if (
    hasAny(m, ["not in australia", "outside australia", "overseas", "not currently in australia", "not there yet"]) ||
    (hasAny(m, ["targeting australia", "move to australia", "coming to australia"]) &&
      hasAny(m, ["not", "overseas", "currently"]))
  ) {
    return "not_in_australia";
  }

  if (
    hasAny(m, [
      "why are you expensive",
      "why expensive",
      "too expensive",
      "price is high",
      "cost is high",
      "why so expensive",
    ])
  ) {
    return "price_objection";
  }

  if (hasAny(m, ["refund", "refunds", "money back", "50% refund"])) {
    return "refund_policy";
  }

  if (
    hasAny(m, ["interview preparation", "interview prep"]) &&
    hasAny(m, ["coaching", "full coaching", "guide", "training"])
  ) {
    return "interview_preparation";
  }

  if (
    hasAny(m, [
      "customize a package",
      "customise a package",
      "custom package",
      "tailor a package",
      "tailored package",
      "personalized package",
      "personalised package",
    ])
  ) {
    return "custom_package";
  }

  if (
    hasAny(m, ["guarantee a job", "guarantee job", "guarantee me a job", "guaranteed job", "job offer guarantee"])
  ) {
    return "job_guarantee";
  }

  if (
    hasAny(m, ["60 days", "60-day", "interview guarantee", "no interview", "dont get an interview", "don't get an interview"]) ||
    (hasAny(m, ["guarantee", "refund", "rewrite"]) && hasAny(m, ["interview", "60", "days"]))
  ) {
    return "interview_guarantee";
  }

  if (hasAny(m, ["installment", "instalment", "pay later", "pay at once", "payment plan", "split payment"])) {
    return "payment_installments";
  }

  if (hasAny(m, ["revision", "revisions", "change the cv", "edit after", "changes after"])) {
    return "revisions";
  }

  if (
    hasAny(m, ["only need a cv", "only need cv", "just need a cv", "just cv", "only resume", "just resume"]) ||
    hasAny(m, ["individual service", "individual services", "single service"])
  ) {
    return "individual_services";
  }

  if (
    hasAny(m, [
      "which package",
      "best package",
      "recommend package",
      "package should i choose",
      "which plan",
      "best plan",
      "plan should i choose",
    ])
  ) {
    return "package_recommendation";
  }

  if (hasAny(m, ["price", "pricing", "cost", "how much", "fee", "charges", "aud"]) || m.includes("expensive")) {
    if (m.includes("essential")) return "essential_pricing";
    if (m.includes("advanced")) return "advanced_pricing";
    if (m.includes("ultimate")) return "ultimate_pricing";
    return "pricing_general";
  }

  if (hasAny(m, ["process", "how does it work", "what happens after", "steps"])) {
    return "process";
  }

  if (hasAny(m, ["industry", "industries", "field", "sector"])) {
    return "industry_support";
  }

  if (hasAny(m, ["australian experience", "local experience"])) {
    return "no_australian_experience";
  }

  if (hasAny(m, ["485", "visa", "temporary graduate", "work rights"]) || /\bpr\b/i.test(m)) {
    return "visa_work_rights";
  }

  if (hasAny(m, ["consultation", "book a call", "free call", "call"])) {
    return "consultation";
  }

  return "general_rag";
}

// ---------------------------------------------------------------------------
// Lead metadata + scoring
// ---------------------------------------------------------------------------

function getLeadMetadata(intent, message) {
  const m = normalizeText(message);
  const tags = [intent];

  let lead_temperature = "cold";
  let package_interest = "unknown";
  let objection = null;
  let handoff_recommended = false;

  if (m.includes("essential")) package_interest = "essential";
  if (m.includes("advanced")) package_interest = "advanced";
  if (m.includes("ultimate")) package_interest = "ultimate";

  if (
    [
      "pricing_general",
      "essential_pricing",
      "advanced_pricing",
      "ultimate_pricing",
      "payment_installments",
      "job_application_support",
      "urgent_delivery",
      "package_recommendation",
      "packages_overview",
      "consultation",
      "price_objection",
      "custom_package",
    ].includes(intent)
  ) {
    lead_temperature = "hot";
    handoff_recommended = true;
  } else if (
    [
      "not_in_australia",
      "visa_work_rights",
      "no_australian_experience",
      "industry_support",
      "individual_services",
      "interview_guarantee",
      "job_guarantee",
      "missed_call_reschedule",
      "refund_policy",
      "interview_preparation",
      "process",
      "revisions",
    ].includes(intent)
  ) {
    lead_temperature = "warm";
  }

  if (m.includes("expensive") || hasAny(m, ["too much", "price", "cost"])) objection = "price";
  if (intent === "price_objection") objection = "price";
  if (intent === "urgent_delivery") objection = "timing";
  if (intent === "not_in_australia") objection = "not_in_australia";
  if (intent === "missed_call_reschedule") objection = "missed_call_reschedule";
  if (intent === "job_application_support") objection = "wants_done_for_you_applications";

  if (
    [
      "refund_policy",
      "custom_package",
      "price_objection",
      "interview_preparation",
      "process",
      "revisions",
      "not_in_australia",
      "no_australian_experience",
      "missed_call_reschedule",
      "job_guarantee",
      "interview_guarantee",
      "visa_work_rights",
      "urgent_delivery",
      "job_application_support",
      "payment_installments",
      "industry_support",
      "individual_services",
    ].includes(intent)
  ) {
    handoff_recommended = true;
  }

  return {
    intent,
    tags,
    lead_temperature,
    package_interest,
    objection,
    handoff_recommended,
  };
}

function calculateLeadScore(meta, message) {
  let score = 0;
  const m = normalizeText(message);

  if (meta.lead_temperature === "hot") score += 60;
  if (meta.lead_temperature === "warm") score += 35;
  if (meta.lead_temperature === "cold") score += 10;

  if (meta.handoff_recommended) score += 15;
  if (meta.package_interest !== "unknown") score += 10;
  if (meta.objection) score += 5;

  if (hasAny(m, ["book", "call", "consultation", "whatsapp", "start", "proceed"])) score += 15;
  if (hasAny(m, ["urgent", "tomorrow", "today", "asap"])) score += 10;
  if (hasAny(m, ["price", "cost", "installment", "instalment", "pay"])) score += 10;
  if (hasAny(m, ["apply for jobs", "apply for me", "ultimate"])) score += 15;

  return Math.max(0, Math.min(100, score));
}

function getSignalReason(meta) {
  if (meta.intent === "job_application_support") return "User is interested in done-for-you job application support.";
  if (meta.intent === "urgent_delivery") return "User has an urgent deadline.";
  if (meta.intent === "price_objection") return "User raised a price objection.";
  if (meta.intent === "payment_installments") return "User asked about payment flexibility.";
  if (meta.intent === "packages_overview") return "User asked about available packages.";
  if (meta.intent === "custom_package") return "User asked about package customization.";
  if (meta.intent === "not_in_australia") return "User is targeting Australia while not currently in Australia.";
  if (meta.intent === "no_australian_experience") return "User is concerned about lack of Australian experience.";
  if (meta.intent === "refund_policy" || meta.intent === "interview_guarantee") return "User asked about refund or interview guarantee.";
  return `Detected intent: ${meta.intent}`;
}

// ---------------------------------------------------------------------------
// Direct safe answers
// ---------------------------------------------------------------------------

function directAnswer(intent) {
  switch (intent) {
    case "packages_overview":
    case "pricing_general":
      return [
        "DreamShift has three main packages:",
        "",
        packageSummary(PACKAGE_FACTS.essential),
        "",
        packageSummary(PACKAGE_FACTS.advanced),
        "",
        packageSummary(PACKAGE_FACTS.ultimate),
        "",
        "You don’t have to pay everything at once. Instalment options are available with an additional AUD 10 charge.",
      ].join("\n");

    case "essential_pricing":
      return packageSummary(PACKAGE_FACTS.essential);

    case "advanced_pricing":
      return packageSummary(PACKAGE_FACTS.advanced);

    case "ultimate_pricing":
      return packageSummary(PACKAGE_FACTS.ultimate);

    case "payment_installments":
      return "Yes. You don’t have to pay everything at once. Instalment options are available with an additional AUD 10 charge. The exact payment arrangement can be discussed during the free consultation call, and you can decide after the call whether you want to proceed.";

    case "job_guarantee":
      return "DreamShift guarantees interviews, not job offers. Job offers depend on interview performance, employer decisions, experience, visa eligibility, market demand, and other factors. If you do not land at least one interview within 60 days of receiving finalized documents and you meet the guarantee conditions, you may request either a 50% refund or a complete rewrite of your CV, Cover Letter, and LinkedIn at no additional cost.";

    case "interview_guarantee":
      return "If you do not land at least one interview within 60 days of receiving finalized documents, and you meet the guarantee conditions, you can request either a 50% refund or a complete rewrite of your CV, Cover Letter, and LinkedIn at no additional cost. The claim must be submitted within 75 days of receiving finalized documents, and you must have actively applied to relevant roles using DreamShift’s documents.";

    case "refund_policy":
      return "DreamShift’s refund option is connected to the 60-day interview guarantee. If you do not land at least one interview within 60 days of receiving finalized documents, and you meet the guarantee conditions, you may request either a 50% refund or a complete rewrite of your CV, Cover Letter, and LinkedIn at no additional cost. Claims must be submitted within 75 days of receiving finalized documents.";

    case "urgent_delivery":
      return "Urgent delivery may be possible depending on team availability. Please contact DreamShift or book a free consultation so the team can check your deadline and confirm whether it can be accommodated.";

    case "job_application_support":
      return "Yes — job application support is available in the **Ultimate Career Package**. It includes 2 months of job application support, a dedicated senior writer, and end-to-end support. Essential and Advanced focus on your job-search toolkit, documents, LinkedIn, strategy, and guidance, but they do not include the same 2-month job application support as Ultimate.";

    case "not_in_australia":
      return "Yes, DreamShift can support clients who are targeting the Australian job market even if they are not currently in Australia. The team can help position your Resume/CV, Cover Letter, and LinkedIn for relevant Australian roles based on your background, target roles, and work rights. DreamShift does not provide migration or visa advice, so visa-specific questions should be discussed with a registered migration professional.";

    case "missed_call_reschedule":
      return "Yes, you can reschedule your consultation. Please use the booking link or contact DreamShift so the team can arrange another available time.";

    case "individual_services":
      return [
        "No, you do not have to buy a full package if you only need one service.",
        "",
        "Individual services are available:",
        listIncludes(INDIVIDUAL_SERVICES),
        "",
        "That said, most clients choose a package because it includes the wider job-search toolkit, such as ATS keyword research, cover letters, LinkedIn optimization, strategy, and support.",
      ].join("\n");

    case "revisions":
      return "Yes, DreamShift offers revisions. Essential includes unlimited revisions within 1 week. Advanced and Ultimate include unlimited revisions within 1 month.";

    case "package_recommendation":
      return [
        "I can help you choose the right package.",
        "",
        "A quick guide:",
        "- Choose **Essential** if you have one specific job opening and need one Resume/CV and one Cover Letter.",
        "- Choose **Advanced** if you want experts to handle your documents, LinkedIn, strategy, and guidance.",
        "- Choose **Ultimate** if you want DreamShift to apply for jobs and handle the process more end-to-end.",
        "",
        "To recommend properly, I’d need to know: are you applying for one specific job or multiple roles, and do you want DreamShift to apply for jobs on your behalf?",
      ].join("\n");

    case "process":
      return [
        "DreamShift follows a structured job-search toolkit process:",
        "",
        "1. You are added to a WhatsApp group with the DreamShift team.",
        "2. The team collects your existing documents and career goals.",
        "3. Job market analysts research your target roles, countries, industries, and sectors.",
        "4. DreamShift prepares job market and ATS keyword research.",
        "5. You complete a detailed questionnaire about your experience, projects, achievements, and transferable skills.",
        "6. The CV writer creates your Resume/CV versions based on your background and target roles.",
        "7. Cover letters are prepared based on your package and CV versions.",
        "8. The LinkedIn specialist works on LinkedIn optimization and branding.",
        "9. You receive guides such as recruiter lists, message templates, referral guidance, and interview preparation guides depending on the package.",
        "10. Ongoing support continues based on your package.",
      ].join("\n");

    case "no_australian_experience":
      return "Yes. Not having Australian experience can be challenging, but DreamShift can still help position your international experience, projects, transferable skills, and achievements for the Australian job market. The focus is on showing recruiters how your background matches the roles you are targeting, while keeping everything honest and evidence-based.";

    case "price_objection":
      return "I understand. DreamShift packages are priced higher than a basic CV rewrite because they include a wider job-search toolkit: job market research, ATS keyword research, Resume/CV writing, Cover Letter writing, LinkedIn optimization, strategy, and support depending on the package. You also don’t have to pay everything at once — instalments are available with an additional AUD 10 charge, and the exact arrangement can be discussed during the free consultation call.";

    case "interview_preparation":
      return "The interview preparation included in Advanced and Ultimate is an interview preparation guide for each interview. It is not a full interview coaching program, and DreamShift does not guarantee interview performance or job offers.";

    case "custom_package":
      return "Yes, packages can be customized based on your needs. Since the right setup depends on your goals, timeline, and the level of support you need, it is best to discuss this during the free consultation call before deciding whether to proceed.";

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Smart retrieval
// ---------------------------------------------------------------------------

function buildSearchQueries(message, intent) {
  const base = [message];

  const intentQueries = {
    packages_overview: [
      "DreamShift packages Essential Advanced Ultimate Career Package prices AUD inclusions",
      "Essential AUD 750 Advanced AUD 800 Ultimate AUD 1500 package comparison",
    ],
    pricing_general: [
      "DreamShift package pricing Essential Advanced Ultimate AUD",
      "Essential AUD 750 Advanced AUD 800 Ultimate Career Package AUD 1500",
    ],
    job_application_support: [
      "job application support Ultimate Career Package apply for jobs on behalf of client",
      "Ultimate Career Package 2 months job application support dedicated senior writer",
    ],
    urgent_delivery: [
      "urgent delivery timing depends on team availability contact free consultation",
      "expedited service urgent project deadline availability",
    ],
    interview_guarantee: [
      "60-day interview guarantee 50% refund complete rewrite conditions 75 days",
      "DreamShift guarantees interviews not jobs refund rewrite",
    ],
    job_guarantee: [
      "DreamShift guarantees interviews not job offers not hiring",
      "job guarantee interview guarantee no job offer guarantee",
    ],
    refund_policy: [
      "refund policy 60-day interview guarantee 50% refund 75 days complete rewrite",
      "non-refundable services refund process admin@dreamshift.net",
    ],
    not_in_australia: [
      "not in Australia currently targeting Australian job market overseas clients visa advice",
      "targeting Australia from overseas DreamShift support work rights no migration advice",
    ],
    no_australian_experience: [
      "no Australian experience international experience transferable skills Australian recruiters",
      "local experience challenge position achievements projects transferable skills",
    ],
    missed_call_reschedule: [
      "missed consultation call reschedule booking link contact DreamShift",
      "reschedule missed call free consultation",
    ],
    individual_services: [
      "individual services Resume CV Writing AUD 400 Cover Letter AUD 150 LinkedIn AUD 350",
      "only need CV individual service not package",
    ],
    revisions: [
      "revision policy Essential 1 week Advanced Ultimate 1 month",
      "unlimited revisions package revision period",
    ],
    process: [
      "DreamShift client process WhatsApp group job market research ATS keyword report questionnaire CV cover letter LinkedIn",
      "all in one job toolkit process job market analysts CV writer LinkedIn specialist",
    ],
    industry_support: [
      "industries supported 40+ Banking Finance IT HR Logistics Manufacturing Retail Marketing Hospitality",
    ],
  };

  return [...base, ...(intentQueries[intent] || [])].slice(0, 3);
}

function keywordBoost(match, intent, originalMessage) {
  const text = `${match?.metadata?.file || ""} ${match?.metadata?.text || ""}`.toLowerCase();
  let boost = 0;

  if (text.includes("critical business facts") || text.includes("critical facts")) boost += 0.2;
  if ((match?.metadata?.category || "") === "critical_facts") boost += 0.2;

  const keywordsByIntent = {
    packages_overview: ["essential", "advanced", "ultimate", "aud 750", "aud 800", "aud 1500"],
    pricing_general: ["price", "pricing", "aud 750", "aud 800", "aud 1500"],
    job_application_support: ["job application support", "ultimate", "2 months", "dedicated senior writer"],
    urgent_delivery: ["urgent", "availability", "deadline", "free consultation"],
    interview_guarantee: ["60", "interview", "50% refund", "rewrite", "75 days"],
    job_guarantee: ["guarantees interviews", "not job offers", "not jobs"],
    refund_policy: ["refund", "50% refund", "75 days", "rewrite"],
    not_in_australia: ["not currently in australia", "targeting australia", "migration advice", "visa advice"],
    no_australian_experience: ["australian experience", "transferable skills", "achievements"],
    missed_call_reschedule: ["reschedule", "missed", "consultation"],
    individual_services: ["aud 400", "aud 150", "aud 350", "individual services"],
    revisions: ["revisions", "1 week", "1 month"],
    process: ["whatsapp group", "job market research", "ats keyword", "questionnaire", "linkedin"],
    industry_support: ["40+ industries", "banking", "finance", "it", "manufacturing"],
  };

  for (const kw of keywordsByIntent[intent] || []) {
    if (text.includes(kw)) boost += 0.05;
  }

  const m = normalizeText(originalMessage);
  for (const token of m.split(" ").filter((t) => t.length > 4)) {
    if (text.includes(token)) boost += 0.01;
  }

  return boost;
}

async function embedText(env, text) {
  const embRaw = await env.AI.run(EMBED_MODEL, { text });
  const vector = normalizeEmbedding(embRaw);

  if (!Array.isArray(vector) || vector.length !== 384) {
    throw new Error(`Bad embedding shape: ${vector?.length}`);
  }

  return vector;
}

async function retrieveSmartContext(env, message, intent) {
  const queries = buildSearchQueries(message, intent);
  const merged = new Map();

  for (const query of queries) {
    const qVec = await embedText(env, query);

    const results = await env.VEC.query(qVec, {
      topK: 8,
      returnMetadata: true,
      includeVectors: false,
    });

    const matches = Array.isArray(results?.matches) ? results.matches : [];

    for (const match of matches) {
      if (!match?.id) continue;
      if (match?.metadata?.kb_version && match.metadata.kb_version !== KB_VERSION) continue;

      const baseScore = typeof match.score === "number" ? match.score : 0;
      const boostedScore = baseScore + keywordBoost(match, intent, message);
      const existing = merged.get(match.id);

      if (!existing || boostedScore > existing._smartScore) {
        merged.set(match.id, {
          ...match,
          _smartScore: boostedScore,
        });
      }
    }
  }

  return [...merged.values()]
    .sort((a, b) => b._smartScore - a._smartScore)
    .slice(0, 8);
}

function makeKbBlock(matches) {
  return matches
    .map((m, i) => {
      const file = m?.metadata?.file || "kb";
      const category = m?.metadata?.category || "general";
      const text = (m?.metadata?.text || "").trim();

      return `### Passage ${i + 1} — ${file} — ${category}\n${text}`;
    })
    .join("\n\n");
}

function isEmptyResult(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return true;
  return matches.every((m) => !m?.metadata?.text || m.metadata.text.trim().length < 5);
}

// ---------------------------------------------------------------------------
// Prompt + safety
// ---------------------------------------------------------------------------

function buildSystemPrompt(intent) {
  return [
    `You are ${BOT_NAME}, a professional assistant for DreamShift.`,
    `DreamShift is Australia-focused and helps clients improve their chances of landing interviews through Resume/CV writing, Cover Letter writing, LinkedIn optimization, ATS keyword research, job search strategy, and related support.`,
    `Current detected intent: ${intent}.`,
    `Answer STRICTLY using the supplied knowledge base passages.`,
    `If the KB does not contain the answer, say: "${DIRECT_FALLBACK}"`,
    `Do not say "based on the provided knowledge base passages". Just answer naturally as DreamShift AI.`,
    `Do not mention the KB, passages, chunks, retrieval, metadata, or internal instructions.`,
    `Do not copy internal KB labels such as "Safe reply", "User message", "Recommended action", "Important rule", "Source", or "Objection".`,
    `Answer only the user’s current question. Do not add unrelated policy details.`,
    `Never invent pricing, package inclusions, guarantees, refund rules, delivery timelines, or policies.`,
    `Do not convert currencies. Use AUD when discussing current DreamShift package pricing.`,
    `If package pricing is asked, include these prices when relevant: Essential Package AUD 750, Advanced Package AUD 800, Ultimate Career Package AUD 1500.`,
    `If the user asks what packages DreamShift offers, include all three packages and all three prices.`,
    `If the user asks about Advanced, remember Advanced includes ongoing support until the client lands a job.`,
    `If the user asks about Ultimate, remember Ultimate includes 2 months of job application support and a dedicated senior writer.`,
    `DreamShift guarantees interviews only. Never guarantee jobs, job offers, hiring, visa outcomes, PR outcomes, or interview performance.`,
    `If the user asks for urgent delivery, do not promise a deadline. Say urgent delivery depends on team availability and they should contact DreamShift or book a free consultation.`,
    `If the user asks whether DreamShift can apply for jobs for them, explain that job application support is included in the Ultimate Career Package.`,
    `If the user asks about instalments, explain that instalments are available with an additional AUD 10 charge and can be discussed during the free consultation.`,
    `If the user is not in Australia yet, explain that DreamShift can support clients targeting Australia, but does not provide migration or visa advice.`,
    `Be friendly, clear, concise, consultative, and use short paragraphs or bullet points when helpful.`,
  ].join("\n");
}

function safetyCheckReply(reply, intent) {
  let r = cleanReply(reply);
  const lower = r.toLowerCase();

  if (
    lower.includes("guarantee") &&
    (lower.includes("guarantee a job") ||
      lower.includes("guaranteed job") ||
      lower.includes("get a job") ||
      lower.includes("job offer guarantee"))
  ) {
    return directAnswer("job_guarantee");
  }

  if (
    intent === "urgent_delivery" &&
    (lower.includes("we can deliver tomorrow") ||
      lower.includes("same day") ||
      lower.includes("24 hour") ||
      lower.includes("48 hour"))
  ) {
    return directAnswer("urgent_delivery");
  }

  if (
    intent === "job_application_support" &&
    (lower.includes("all packages include job application") ||
      lower.includes("essential includes job application") ||
      lower.includes("advanced includes job application"))
  ) {
    return directAnswer("job_application_support");
  }

  return r;
}

// ---------------------------------------------------------------------------
// Tracking + D1 persistence
// ---------------------------------------------------------------------------

function getTrackingContext(request, body) {
  const requestCf = request.cf || {};

  return {
    session_id: body.session_id || makeId("sess"),
    visitor_id: body.visitor_id || null,
    page_url: body.page_url || body.url || null,
    referrer: body.referrer || request.headers.get("referer") || null,
    user_agent: body.user_agent || request.headers.get("user-agent") || null,
    utm_source: body.utm_source || null,
    utm_medium: body.utm_medium || null,
    utm_campaign: body.utm_campaign || null,
    utm_content: body.utm_content || null,
    utm_term: body.utm_term || null,
    country: body.country || requestCf.country || null,
    city: body.city || requestCf.city || null,
  };
}

async function persistInteraction(env, payload) {
  const db = getDb(env);
  if (!db) return;

  const { tracking, userMessage, botReply, meta } = payload;
  const sessionId = tracking.session_id;
  const leadScore = calculateLeadScore(meta, userMessage);
  const topSourcesJson = safeJson(meta.top_sources || null);

  try {
    await db
      .prepare(
        `
        INSERT INTO chat_sessions (
          session_id,
          visitor_id,
          page_url,
          referrer,
          user_agent,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          country,
          city,
          total_messages,
          last_intent,
          lead_temperature,
          package_interest,
          objection,
          handoff_recommended
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          last_seen_at = CURRENT_TIMESTAMP,
          page_url = COALESCE(excluded.page_url, chat_sessions.page_url),
          referrer = COALESCE(excluded.referrer, chat_sessions.referrer),
          user_agent = COALESCE(excluded.user_agent, chat_sessions.user_agent),
          utm_source = COALESCE(excluded.utm_source, chat_sessions.utm_source),
          utm_medium = COALESCE(excluded.utm_medium, chat_sessions.utm_medium),
          utm_campaign = COALESCE(excluded.utm_campaign, chat_sessions.utm_campaign),
          utm_content = COALESCE(excluded.utm_content, chat_sessions.utm_content),
          utm_term = COALESCE(excluded.utm_term, chat_sessions.utm_term),
          country = COALESCE(excluded.country, chat_sessions.country),
          city = COALESCE(excluded.city, chat_sessions.city),
          total_messages = chat_sessions.total_messages + 1,
          last_intent = excluded.last_intent,
          lead_temperature = excluded.lead_temperature,
          package_interest = excluded.package_interest,
          objection = excluded.objection,
          handoff_recommended = excluded.handoff_recommended
        `
      )
      .bind(
        sessionId,
        tracking.visitor_id,
        tracking.page_url,
        tracking.referrer,
        tracking.user_agent,
        tracking.utm_source,
        tracking.utm_medium,
        tracking.utm_campaign,
        tracking.utm_content,
        tracking.utm_term,
        tracking.country,
        tracking.city,
        meta.intent,
        meta.lead_temperature,
        meta.package_interest,
        meta.objection,
        boolInt(meta.handoff_recommended)
      )
      .run();

    for (const row of [
      { role: "user", content: userMessage },
      { role: "assistant", content: botReply },
    ]) {
      await db
        .prepare(
          `
          INSERT INTO chat_messages (
            message_id,
            session_id,
            role,
            content,
            intent,
            answer_mode,
            lead_temperature,
            package_interest,
            objection,
            handoff_recommended,
            kb_version,
            retrieved_chunks,
            top_sources_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          makeId("msg"),
          sessionId,
          row.role,
          row.content,
          meta.intent,
          meta.answer_mode || null,
          meta.lead_temperature,
          meta.package_interest,
          meta.objection,
          boolInt(meta.handoff_recommended),
          meta.kb_version || KB_VERSION,
          meta.retrieved_chunks || null,
          topSourcesJson
        )
        .run();
    }

    await db
      .prepare(
        `
        INSERT INTO chat_events (
          event_id,
          session_id,
          event_name,
          event_payload_json
        )
        VALUES (?, ?, ?, ?)
        `
      )
      .bind(
        makeId("evt"),
        sessionId,
        "chat_interaction",
        safeJson({
          intent: meta.intent,
          answer_mode: meta.answer_mode,
          lead_temperature: meta.lead_temperature,
          package_interest: meta.package_interest,
          objection: meta.objection,
          handoff_recommended: meta.handoff_recommended,
          lead_score: leadScore,
        })
      )
      .run();

    if (meta.handoff_recommended || meta.lead_temperature !== "cold") {
      await db
        .prepare(
          `
          INSERT INTO lead_signals (
            signal_id,
            session_id,
            intent,
            lead_temperature,
            package_interest,
            objection,
            handoff_recommended,
            lead_score,
            signal_reason
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .bind(
          makeId("sig"),
          sessionId,
          meta.intent,
          meta.lead_temperature,
          meta.package_interest,
          meta.objection,
          boolInt(meta.handoff_recommended),
          leadScore,
          getSignalReason(meta)
        )
        .run();
    }

    if (meta.answer_mode === "fallback_no_context" || botReply === DIRECT_FALLBACK) {
      await db
        .prepare(
          `
          INSERT INTO content_gaps (
            gap_id,
            session_id,
            question,
            reason,
            status
          )
          VALUES (?, ?, ?, ?, 'open')
          `
        )
        .bind(
          makeId("gap"),
          sessionId,
          userMessage,
          "Bot could not find enough KB context to answer safely."
        )
        .run();
    }
  } catch (e) {
    console.error("D1_PERSIST_ERROR", e);
  }
}

// ---------------------------------------------------------------------------
// Event + analytics helpers
// ---------------------------------------------------------------------------

function cleanEventName(eventName) {
  return (eventName || "")
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
}

function getAdminKeyFromRequest(request) {
  const url = new URL(request.url);
  const headerKey = request.headers.get("x-admin-key");
  const bearer = request.headers.get("authorization") || "";

  if (headerKey) return headerKey;

  if (bearer.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim();
  }

  return url.searchParams.get("key");
}

function requireAdmin(request, env) {
  if (!env.ADMIN_KEY) {
    return {
      ok: false,
      response: err("ADMIN_KEY secret is not configured", 500),
    };
  }

  const providedKey = getAdminKeyFromRequest(request);

  if (!providedKey || providedKey !== env.ADMIN_KEY) {
    return {
      ok: false,
      response: err("Unauthorized", 401),
    };
  }

  return { ok: true };
}

function clampDays(value) {
  const parsed = Number.parseInt(value || "30", 10);

  if (Number.isNaN(parsed)) return 30;
  if (parsed < 1) return 1;
  if (parsed > 365) return 365;

  return parsed;
}

async function dbAll(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).all();
  return result?.results || [];
}

async function dbFirst(db, sql, ...params) {
  const result = await db.prepare(sql).bind(...params).first();
  return result || {};
}

function buildDashboardRecommendations(data) {
  const recommendations = [];
  const topIntent = data.top_intents?.[0]?.intent || null;
  const topObjection = data.top_objections?.[0]?.objection || null;

  if (topIntent === "job_application_support") {
    recommendations.push({
      priority: "high",
      title: "Promote Ultimate Career Package earlier",
      insight: "Job application support is one of the strongest buying signals.",
      action: "Show the Ultimate Career Package CTA earlier in the chat and on the website.",
    });
  }

  if (topIntent === "payment_installments") {
    recommendations.push({
      priority: "medium",
      title: "Show instalment messaging earlier",
      insight: "Users are actively asking about payment flexibility.",
      action: "Mention instalments and the AUD 10 charge in pricing-related responses and package sections.",
    });
  }

  if (topObjection === "price") {
    recommendations.push({
      priority: "high",
      title: "Address price objections with value framing",
      insight: "Price is a common concern among chatbot users.",
      action: "Explain that DreamShift is a full job-search toolkit, not just a basic CV rewrite.",
    });
  }

  if (topObjection === "timing") {
    recommendations.push({
      priority: "medium",
      title: "Create a clearer urgent delivery pathway",
      insight: "Some users need urgent help.",
      action: "Add a clear urgent-request CTA that routes users to WhatsApp for availability confirmation.",
    });
  }

  if (data.overview?.content_gaps_30d > 0) {
    recommendations.push({
      priority: "medium",
      title: "Update the knowledge base",
      insight: "Some questions could not be answered safely.",
      action: "Review open content gaps and add missing answers to the KB.",
    });
  }

  if (data.overview?.hot_leads_30d > 0 && data.overview?.whatsapp_clicks_30d === 0) {
    recommendations.push({
      priority: "high",
      title: "Make WhatsApp handoff more visible",
      insight: "Hot leads are appearing, but WhatsApp clicks are low.",
      action: "Add a stronger WhatsApp CTA after high-intent answers.",
    });
  }

  if (data.overview?.hot_leads_30d > 0 && data.overview?.booking_clicks_30d === 0) {
    recommendations.push({
      priority: "medium",
      title: "Improve booking/contact CTA visibility",
      insight: "Hot leads are appearing, but booking/contact clicks are low.",
      action: "Show the start.dreamshift.net CTA after pricing, package, and consultation questions.",
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: "low",
      title: "Keep collecting data",
      insight: "No major issue is visible yet.",
      action: "Continue monitoring intents, objections, CTA clicks, and content gaps.",
    });
  }

  return recommendations.slice(0, 6);
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/ingest" && request.method === "POST") {
        return await ingestRoute(request, env);
      }

      if (url.pathname === "/chat" && request.method === "POST") {
        return await chatRoute(request, env, ctx);
      }

      if (url.pathname === "/event" && request.method === "POST") {
        return await eventRoute(request, env);
      }

      if (url.pathname === "/analytics/summary" && request.method === "GET") {
        return await analyticsSummaryRoute(request, env);
      }

      if (request.method === "GET") {
        return new Response("DreamShift Bot up", {
          headers: { "access-control-allow-origin": "*" },
        });
      }

      return err("No route for that URI", 404);
    } catch (e) {
      console.error("UNCAUGHT", e);
      return err("Internal error", 500);
    }
  },
};

// ---------------------------------------------------------------------------
// /ingest
// ---------------------------------------------------------------------------

async function ingestRoute(request, env) {
  const headerKey = request.headers.get("x-ingest-key") || "";

  if (!env.INGEST_KEY || headerKey !== env.INGEST_KEY) {
    return err("Forbidden", 403);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const file = (body.file || "").toString().trim();
  const raw = (body.text || "").toString();

  if (!file || !raw.trim()) {
    return err("Missing file/text", 400);
  }

  const category = inferCategoryFromFile(file);
  const chunks = chunkText(raw);
  let inserted = 0;

  for (let i = 0; i < chunks.length; i++) {
    const text = chunks[i];
    const vector = await embedText(env, text);
    const id = makeShortVectorId(file, i);

    await env.VEC.upsert([
      {
        id,
        values: vector,
        metadata: {
          file,
          text,
          kb_version: KB_VERSION,
          market: "australia",
          category,
          chunk_index: i,
          source_type: "markdown_kb",
        },
      },
    ]);

    inserted++;
  }

  return ok({
    ok: true,
    file,
    category,
    chunks: chunks.length,
    inserted,
    kb_version: KB_VERSION,
  });
}

// ---------------------------------------------------------------------------
// /chat
// ---------------------------------------------------------------------------

async function chatRoute(request, env, ctx) {
  let body;

  try {
    const raw = await request.text();
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return err("Invalid JSON body", 400);
  }

  const message = (body.message || "").toString().trim();

  if (!message) {
    return err("Missing message", 400);
  }

  const tracking = getTrackingContext(request, body);
  const intent = classifyIntent(message);
  const lead = getLeadMetadata(intent, message);
  const templated = directAnswer(intent);

  if (templated) {
    const meta = {
      ...lead,
      answer_mode: "direct_template",
      kb_version: KB_VERSION,
    };

    ctx.waitUntil(
      persistInteraction(env, {
        tracking,
        userMessage: message,
        botReply: templated,
        meta,
      })
    );

    return ok({
      reply: templated,
      session_id: tracking.session_id,
      meta,
    });
  }

  const matches = await retrieveSmartContext(env, message, intent);

  if (isEmptyResult(matches)) {
    const meta = {
      ...lead,
      answer_mode: "fallback_no_context",
      kb_version: KB_VERSION,
    };

    ctx.waitUntil(
      persistInteraction(env, {
        tracking,
        userMessage: message,
        botReply: DIRECT_FALLBACK,
        meta,
      })
    );

    return ok({
      reply: DIRECT_FALLBACK,
      session_id: tracking.session_id,
      meta,
    });
  }

  const kbBlock = makeKbBlock(matches);

  const userContent = [
    `User question: ${message}`,
    ``,
    `Knowledge base passages:`,
    kbBlock,
    ``,
    `Answer the user naturally using only the relevant KB information.`,
    `Do not mention the KB or passages.`,
    `Do not include internal labels like "Safe reply", "User message", "Recommended action", or "Important rule".`,
  ].join("\n");

  const completion = await env.AI.run(CHAT_MODEL, {
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(intent),
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: 0.15,
    max_tokens: 650,
  });

  const rawReply =
    completion?.response ||
    completion?.result ||
    (typeof completion === "string" ? completion : null) ||
    DIRECT_FALLBACK;

  const reply = safetyCheckReply(rawReply, intent);

  const meta = {
    ...lead,
    answer_mode: "smart_rag",
    retrieved_chunks: matches.length,
    top_sources: matches.slice(0, 5).map((m) => ({
      file: m?.metadata?.file || null,
      category: m?.metadata?.category || null,
      score: m?._smartScore || m?.score || null,
    })),
    kb_version: KB_VERSION,
  };

  ctx.waitUntil(
    persistInteraction(env, {
      tracking,
      userMessage: message,
      botReply: reply,
      meta,
    })
  );

  return ok({
    reply,
    session_id: tracking.session_id,
    meta,
  });
}

// ---------------------------------------------------------------------------
// /event
// ---------------------------------------------------------------------------

async function eventRoute(request, env) {
  const db = getDb(env);

  if (!db) {
    return err("D1 database binding not found", 500);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }

  const eventName = cleanEventName(body.event_name || body.event || "");

  if (!eventName) {
    return err("Missing event_name", 400);
  }

  const tracking = getTrackingContext(request, body);
  const sessionId = tracking.session_id;

  const eventPayload = {
    event_name: eventName,
    label: body.label || null,
    value: body.value || null,
    page_url: tracking.page_url,
    referrer: tracking.referrer,
    utm_source: tracking.utm_source,
    utm_medium: tracking.utm_medium,
    utm_campaign: tracking.utm_campaign,
    utm_content: tracking.utm_content,
    utm_term: tracking.utm_term,
    extra: body.extra || null,
  };

  try {
    await db
      .prepare(
        `
        INSERT INTO chat_sessions (
          session_id,
          visitor_id,
          page_url,
          referrer,
          user_agent,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_content,
          utm_term,
          country,
          city,
          total_messages
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(session_id) DO UPDATE SET
          last_seen_at = CURRENT_TIMESTAMP,
          page_url = COALESCE(excluded.page_url, chat_sessions.page_url),
          referrer = COALESCE(excluded.referrer, chat_sessions.referrer),
          user_agent = COALESCE(excluded.user_agent, chat_sessions.user_agent),
          utm_source = COALESCE(excluded.utm_source, chat_sessions.utm_source),
          utm_medium = COALESCE(excluded.utm_medium, chat_sessions.utm_medium),
          utm_campaign = COALESCE(excluded.utm_campaign, chat_sessions.utm_campaign),
          utm_content = COALESCE(excluded.utm_content, chat_sessions.utm_content),
          utm_term = COALESCE(excluded.utm_term, chat_sessions.utm_term),
          country = COALESCE(excluded.country, chat_sessions.country),
          city = COALESCE(excluded.city, chat_sessions.city)
        `
      )
      .bind(
        sessionId,
        tracking.visitor_id,
        tracking.page_url,
        tracking.referrer,
        tracking.user_agent,
        tracking.utm_source,
        tracking.utm_medium,
        tracking.utm_campaign,
        tracking.utm_content,
        tracking.utm_term,
        tracking.country,
        tracking.city
      )
      .run();

    await db
      .prepare(
        `
        INSERT INTO chat_events (
          event_id,
          session_id,
          event_name,
          event_payload_json
        )
        VALUES (?, ?, ?, ?)
        `
      )
      .bind(makeId("evt"), sessionId, eventName, safeJson(eventPayload))
      .run();

    if (["whatsapp_clicked", "booking_clicked", "contact_clicked"].includes(eventName)) {
      await db
        .prepare(
          `
          UPDATE chat_sessions
          SET
            last_seen_at = CURRENT_TIMESTAMP,
            lead_temperature = 'hot',
            handoff_recommended = 1
          WHERE session_id = ?
          `
        )
        .bind(sessionId)
        .run();

      await db
        .prepare(
          `
          INSERT INTO lead_signals (
            signal_id,
            session_id,
            intent,
            lead_temperature,
            package_interest,
            objection,
            handoff_recommended,
            lead_score,
            signal_reason
          )
          VALUES (?, ?, ?, 'hot', 'unknown', NULL, 1, 90, ?)
          `
        )
        .bind(
          makeId("sig"),
          sessionId,
          eventName,
          eventName === "whatsapp_clicked"
            ? "User clicked WhatsApp CTA."
            : "User clicked booking/contact CTA."
        )
        .run();
    }

    return ok({
      ok: true,
      session_id: sessionId,
      event_name: eventName,
    });
  } catch (e) {
    console.error("EVENT_ROUTE_ERROR", e);
    return err("Could not store event", 500);
  }
}

// ---------------------------------------------------------------------------
// /analytics/summary
// ---------------------------------------------------------------------------

async function analyticsSummaryRoute(request, env) {
  const auth = requireAdmin(request, env);

  if (!auth.ok) return auth.response;

  const db = getDb(env);

  if (!db) {
    return err("D1 database binding not found", 500);
  }

  const url = new URL(request.url);
  const days = clampDays(url.searchParams.get("days"));
  const since = `-${days} days`;

  try {
    const overview = await dbFirst(
      db,
      `
      SELECT
        (SELECT COUNT(*) FROM chat_sessions WHERE first_seen_at >= datetime('now', ?)) AS sessions_30d,
        (SELECT COUNT(*) FROM chat_messages WHERE role = 'user' AND created_at >= datetime('now', ?)) AS user_messages_30d,
        (SELECT COUNT(*) FROM chat_sessions WHERE lead_temperature = 'hot' AND last_seen_at >= datetime('now', ?)) AS hot_leads_30d,
        (SELECT COUNT(*) FROM chat_sessions WHERE handoff_recommended = 1 AND last_seen_at >= datetime('now', ?)) AS handoff_recommended_30d,
        (SELECT COUNT(*) FROM chat_events WHERE event_name = 'chat_opened' AND created_at >= datetime('now', ?)) AS chat_opens_30d,
        (SELECT COUNT(*) FROM chat_events WHERE event_name = 'quick_action_clicked' AND created_at >= datetime('now', ?)) AS quick_action_clicks_30d,
        (SELECT COUNT(*) FROM chat_events WHERE event_name = 'whatsapp_clicked' AND created_at >= datetime('now', ?)) AS whatsapp_clicks_30d,
        (SELECT COUNT(*) FROM chat_events WHERE event_name IN ('booking_clicked', 'contact_clicked') AND created_at >= datetime('now', ?)) AS booking_clicks_30d,
        (SELECT COUNT(*) FROM content_gaps WHERE status = 'open' AND created_at >= datetime('now', ?)) AS content_gaps_30d,
        (SELECT COUNT(*) FROM chat_messages WHERE answer_mode = 'fallback_no_context' AND created_at >= datetime('now', ?)) AS fallback_answers_30d,
        (SELECT ROUND(AVG(lead_score), 1) FROM lead_signals WHERE created_at >= datetime('now', ?)) AS avg_lead_score_30d
      `,
      since,
      since,
      since,
      since,
      since,
      since,
      since,
      since,
      since,
      since,
      since
    );

    const sessions30 = num(overview.sessions_30d);
    const userMessages30 = num(overview.user_messages_30d);
    const hotLeads30 = num(overview.hot_leads_30d);
    const handoffs30 = num(overview.handoff_recommended_30d);

    const overviewWithRates = {
      ...overview,
      period_days: days,
      hot_lead_rate: pct(hotLeads30, sessions30),
      handoff_rate: pct(handoffs30, sessions30),
      fallback_rate: pct(num(overview.fallback_answers_30d), userMessages30),
      whatsapp_click_rate: pct(num(overview.whatsapp_clicks_30d), sessions30),
      booking_click_rate: pct(num(overview.booking_clicks_30d), sessions30),
    };

    const topIntents = await dbAll(
      db,
      `
      SELECT
        intent,
        COUNT(*) AS count
      FROM chat_messages
      WHERE role = 'user'
        AND intent IS NOT NULL
        AND created_at >= datetime('now', ?)
      GROUP BY intent
      ORDER BY count DESC
      LIMIT 10
      `,
      since
    );

    const topObjections = await dbAll(
      db,
      `
      SELECT
        objection,
        COUNT(*) AS count
      FROM chat_messages
      WHERE role = 'user'
        AND objection IS NOT NULL
        AND objection != ''
        AND created_at >= datetime('now', ?)
      GROUP BY objection
      ORDER BY count DESC
      LIMIT 10
      `,
      since
    );

    const packageInterest = await dbAll(
      db,
      `
      SELECT
        package_interest,
        COUNT(*) AS count
      FROM chat_sessions
      WHERE package_interest IS NOT NULL
        AND package_interest != ''
        AND last_seen_at >= datetime('now', ?)
      GROUP BY package_interest
      ORDER BY count DESC
      LIMIT 10
      `,
      since
    );

    const eventCounts = await dbAll(
      db,
      `
      SELECT
        event_name,
        COUNT(*) AS count
      FROM chat_events
      WHERE created_at >= datetime('now', ?)
      GROUP BY event_name
      ORDER BY count DESC
      LIMIT 15
      `,
      since
    );

    const sourcePerformance = await dbAll(
      db,
      `
      SELECT
        COALESCE(utm_source, 'unknown') AS source,
        COALESCE(utm_medium, 'unknown') AS medium,
        COALESCE(utm_campaign, 'unknown') AS campaign,
        COUNT(*) AS sessions,
        SUM(CASE WHEN lead_temperature = 'hot' THEN 1 ELSE 0 END) AS hot_leads,
        SUM(CASE WHEN handoff_recommended = 1 THEN 1 ELSE 0 END) AS handoffs
      FROM chat_sessions
      WHERE last_seen_at >= datetime('now', ?)
      GROUP BY source, medium, campaign
      ORDER BY hot_leads DESC, sessions DESC
      LIMIT 15
      `,
      since
    );

    const dailyTrend = await dbAll(
      db,
      `
      SELECT
        date(first_seen_at) AS date,
        COUNT(*) AS sessions,
        SUM(CASE WHEN lead_temperature = 'hot' THEN 1 ELSE 0 END) AS hot_leads,
        SUM(CASE WHEN handoff_recommended = 1 THEN 1 ELSE 0 END) AS handoffs
      FROM chat_sessions
      WHERE first_seen_at >= datetime('now', ?)
      GROUP BY date(first_seen_at)
      ORDER BY date ASC
      `,
      since
    );

    const recentHotLeads = await dbAll(
      db,
      `
      SELECT
        s.session_id,
        s.visitor_id,
        s.last_seen_at,
        s.page_url,
        s.utm_source,
        s.utm_medium,
        s.utm_campaign,
        s.last_intent,
        s.lead_temperature,
        s.package_interest,
        s.objection,
        s.handoff_recommended,
        s.total_messages,
        (
          SELECT substr(m.content, 1, 160)
          FROM chat_messages m
          WHERE m.session_id = s.session_id
            AND m.role = 'user'
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_user_message
      FROM chat_sessions s
      WHERE s.last_seen_at >= datetime('now', ?)
        AND (
          s.lead_temperature = 'hot'
          OR s.handoff_recommended = 1
        )
      ORDER BY s.last_seen_at DESC
      LIMIT 20
      `,
      since
    );

    const contentGaps = await dbAll(
      db,
      `
      SELECT
        gap_id,
        session_id,
        question,
        reason,
        status,
        created_at
      FROM content_gaps
      WHERE created_at >= datetime('now', ?)
      ORDER BY created_at DESC
      LIMIT 20
      `,
      since
    );

    const summary = {
      overview: overviewWithRates,
      top_intents: topIntents,
      top_objections: topObjections,
      package_interest: packageInterest,
      event_counts: eventCounts,
      source_performance: sourcePerformance.map((row) => ({
        ...row,
        hot_lead_rate: pct(row.hot_leads, row.sessions),
        handoff_rate: pct(row.handoffs, row.sessions),
      })),
      daily_trend: dailyTrend,
      recent_hot_leads: recentHotLeads,
      content_gaps: contentGaps,
    };

    return ok({
      ok: true,
      generated_at: new Date().toISOString(),
      period_days: days,
      ...summary,
      recommendations: buildDashboardRecommendations(summary),
    });
  } catch (e) {
    console.error("ANALYTICS_SUMMARY_ERROR", e);
    return err("Could not build analytics summary", 500);
  }
}