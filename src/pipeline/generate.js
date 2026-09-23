import { stableId } from "./id.js";
import { keywords } from "./text.js";

const CATEGORIES = ["technical", "behavioural", "system-design", "company-fit"];

export function generateCompanyBrief(research) {
  return {
    summary: `${research.companyName || "The company"}: ${research.whatTheyDo}`,
    what_they_do: research.whatTheyDo,
    sources: research.pagesUsed
  };
}

export function generateQuestions(requirements, research, existing = []) {
  const generated = [];
  for (const requirement of requirements) {
    const category = categoryForRequirement(requirement, research);
    generated.push({
      id: stableId("q", generated.length),
      requirement_ids: [requirement.id],
      category,
      prompt: promptFor(requirement, category, research),
      answer_outline: outlineFor(requirement, category, research),
      difficulty: difficultyFor(requirement),
      state: "generated",
      pinned: false
    });
  }

  if (research.hiringNotes && !/No dedicated/i.test(research.hiringNotes)) {
    generated.push({
      id: stableId("q", generated.length),
      requirement_ids: requirements.filter((req) => req.priority === "must").slice(0, 3).map((req) => req.id),
      category: "company-fit",
      prompt: `How would you prepare for ${research.companyName}'s stated interview process?`,
      answer_outline: `Reference the discovered process: ${research.hiringNotes.slice(0, 360)}`,
      difficulty: 2,
      state: "generated",
      pinned: false
    });
  }

  return mergePreservingManual(existing, generated);
}

export function generateMissingQuestions(requirements, uncoveredIds, questions, research) {
  const additions = requirements
    .filter((req) => uncoveredIds.includes(req.id))
    .map((req, index) => ({
      id: stableId("q", questions.length + index),
      requirement_ids: [req.id],
      category: categoryForRequirement(req, research),
      prompt: `Coverage follow-up: show evidence for this requirement: ${req.text}`,
      answer_outline: "Use a specific example, decisions made, trade-offs, measurable result, and what you would improve.",
      difficulty: difficultyFor(req),
      state: "generated",
      pinned: false
    }));
  return [...questions, ...additions];
}

export function generateFlashcards(requirements, research, existing = []) {
  const generated = requirements.slice(0, 18).map((requirement, index) => {
    const words = keywords(requirement.text, 3).join(", ") || requirement.text;
    return {
      id: stableId("f", index),
      front: `What proof point should you prepare for: ${words}?`,
      back: `Prepare a concise story or explanation covering ${requirement.text}. Tie it to ${research.companyName || "the company"} where relevant.`,
      requirement_ids: [requirement.id],
      state: "generated",
      pinned: false,
      confidence: null,
      last_reviewed_at: null
    };
  });
  return mergePreservingManual(existing, generated);
}

export function categoryForRequirement(requirement, research) {
  if (/architecture|distributed|scale|system|platform/i.test(requirement.text)) return "system-design";
  if (requirement.kind === "behavioural") return "behavioural";
  if (/culture|values|mission|company/i.test(requirement.text + " " + research.hiringNotes)) return "company-fit";
  return "technical";
}

function promptFor(requirement, category, research) {
  if (category === "behavioural") return `Tell me about a time you demonstrated: ${requirement.text}`;
  if (category === "system-design") return `Design or critique a system that proves your ability with: ${requirement.text}`;
  if (category === "company-fit") return `How does your background map to ${research.companyName}'s work and this requirement: ${requirement.text}?`;
  return `How would you approach a practical problem involving: ${requirement.text}?`;
}

function outlineFor(requirement, category, research) {
  const company = research.companyName || "the company";
  const base = `Cover the requirement directly, name tools or methods, explain trade-offs, and include a concrete result.`;
  if (category === "company-fit") return `${base} Connect the answer to ${company}: ${research.whatTheyDo.slice(0, 240)}`;
  if (category === "system-design") return `${base} Discuss constraints, data model, APIs, failure modes, observability, and scaling path.`;
  if (category === "behavioural") return `${base} Use STAR format and include what changed because of your action.`;
  return base;
}

function difficultyFor(requirement) {
  let score = requirement.priority === "must" ? 2 : 1;
  if (/\b(senior|lead|architecture|scale|distributed|security|5\+|6\+|7\+|8\+)\b/i.test(requirement.text)) score += 1;
  return Math.min(3, score);
}

function mergePreservingManual(existing, generated) {
  const manual = existing.filter((item) => item.state === "edited" || item.state === "manual" || item.pinned);
  const manualIds = new Set(manual.map((item) => item.id));
  return [...manual, ...generated.filter((item) => !manualIds.has(item.id))].map((item, index) => ({
    ...item,
    id: item.id || stableId("x", index)
  }));
}

export { CATEGORIES };
