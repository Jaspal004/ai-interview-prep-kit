import { extractRole } from "./extract.js";
import { researchCompany } from "./research.js";
import { generateCompanyBrief, generateFlashcards, generateMissingQuestions, generateQuestions } from "./generate.js";
import { checkCoverage } from "./coverage.js";
import { buildSchedule } from "./schedule.js";
import { validateKit } from "./validate.js";
import { enhanceKitWithLlm } from "./llm.js";

export async function generateKit({ jd, company_url, days }, options = {}) {
  if (!String(jd || "").trim()) throw Object.assign(new Error("Job description is required"), { code: "INVALID_INPUT" });
  if (!String(company_url || "").trim()) throw Object.assign(new Error("Company URL is required"), { code: "INVALID_INPUT" });

  const role = extractRole(jd);
  const research = await researchCompany(company_url, options);
  const requirements = role.requirements;
  let questions = generateQuestions(requirements, research);
  let uncovered = checkCoverage(requirements, questions);
  let passes = 1;

  while (uncovered.length && passes < 3) {
    questions = generateMissingQuestions(requirements, uncovered, questions, research);
    uncovered = checkCoverage(requirements, questions);
    passes += 1;
  }

  const draft = {
    source: {
      company: research.companyName || "",
      company_url,
      role: role.title,
      location: role.location,
      jd_chars: String(jd).length,
      researched_at: research.researchedAt,
      pages_used: research.pagesUsed
    },
    company_brief: generateCompanyBrief(research),
    role: {
      title: role.title,
      seniority: role.seniority,
      responsibilities: role.responsibilities,
      requirements
    },
    questions,
    flashcards: generateFlashcards(requirements, research),
    schedule: buildSchedule(days, requirements, questions),
    coverage: {
      uncovered_requirement_ids: uncovered,
      passes
    },
    research_notes: {
      skipped_sources: research.skippedSources,
      hiring_notes: research.hiringNotes,
      public_discussion: research.publicDiscussion,
      public_discussion_sources: research.publicDiscussionSources || []
    }
  };

  const enhanced = await enhanceKitWithLlm(draft, research);
  const kit = enhanced.kit;
  kit.generation_notes = {
    llm_provider: enhanced.provider,
    llm_used: enhanced.used,
    llm_error: enhanced.error
  };

  return validateKit(kit);
}

export function regenerateSection(kit, section) {
  const research = {
    companyName: kit.source.company,
    pagesUsed: kit.source.pages_used,
    whatTheyDo: kit.company_brief.what_they_do,
    hiringNotes: kit.research_notes?.hiring_notes || ""
  };
  if (section === "company_brief") {
    return { ...kit, company_brief: generateCompanyBrief(research) };
  }
  if (section === "flashcards") {
    return { ...kit, flashcards: generateFlashcards(kit.role.requirements, research, kit.flashcards) };
  }
  if (section === "schedule") {
    return { ...kit, schedule: buildSchedule(kit.schedule.days_available, kit.role.requirements, kit.questions) };
  }
  if (section?.startsWith("questions:")) {
    const category = section.split(":")[1];
    const keep = kit.questions.filter((question) => question.category !== category || question.state === "edited" || question.state === "manual" || question.pinned);
    const regenerated = generateQuestions(kit.role.requirements.filter((req) => req.kind === category || category === "technical"), research, keep)
      .filter((question) => question.category === category || keep.some((item) => item.id === question.id));
    const next = { ...kit, questions: [...keep, ...regenerated.filter((question) => !keep.some((item) => item.id === question.id))] };
    return { ...next, schedule: buildSchedule(kit.schedule.days_available, kit.role.requirements, next.questions) };
  }
  return kit;
}
