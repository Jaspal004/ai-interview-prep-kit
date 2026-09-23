import { sentences, keywords } from "./text.js";
import { stableId } from "./id.js";

const MUST_HINTS = /\b(required|must|need(?:ed)?|you have|we expect|minimum|proven|responsible for|own|lead|build|design|develop|ship)\b/i;
const NICE_HINTS = /\b(nice to have|bonus|preferred|plus|familiarity|would be great|ideally)\b/i;
const TECH_HINTS = /\b(react|node|typescript|javascript|python|java|go|ruby|sql|mongodb|postgres|aws|gcp|azure|kubernetes|docker|api|graphql|rest|frontend|backend|full-stack|testing|ci\/cd|llm|ai|ml|data|system design|security)\b/i;
const BEHAVIOUR_HINTS = /\b(mentor|mentoring|lead|communicat|collaborat|stakeholder|ownership|cross-functional|coach|manage|influence)\b/i;
const REQUIREMENT_HEADING = /\b(requirements?|qualifications?|what you(?:'|')ll need|you have|we expect|must have)\b/i;
const NICE_HEADING = /\b(nice to have|preferred|bonus|plus|ideally)\b/i;
const RESPONSIBILITY_HEADING = /\b(responsibilities|what you(?:'|')ll do|about the role|role)\b/i;

export function extractRole(jd) {
  const lines = String(jd || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const titleLine = lines.find((line) => /\b(engineer|developer|manager|designer|analyst|scientist|architect|lead)\b/i.test(line)) || lines[0] || "Unspecified role";
  const locationLine = lines.find((line) => /\b(remote|hybrid|onsite|new york|london|india|united states|canada|europe)\b/i.test(line)) || "";

  const candidateSentences = sentences(jd)
    .filter((line) => line.length > 8 && line.length < 260)
    .filter((line) => MUST_HINTS.test(line) || NICE_HINTS.test(line) || TECH_HINTS.test(line) || BEHAVIOUR_HINTS.test(line));

  const requirementTexts = [];
  const priorities = new Map();
  for (const item of extractRequirementLines(lines)) {
    addRequirement(requirementTexts, priorities, item.text, item.priority);
  }
  for (const line of candidateSentences) {
    for (const fragment of splitRequirementFragments(line)) {
      addRequirement(requirementTexts, priorities, fragment, inferPriority(fragment));
    }
  }

  if (requirementTexts.length === 0) {
    const top = keywords(jd, 5);
    if (top.length) addRequirement(requirementTexts, priorities, `Discuss experience related to ${top.join(", ")}`, "must");
  }

  const requirements = requirementTexts.slice(0, 12).map((text, index) => ({
    id: stableId("r", index),
    text,
    kind: BEHAVIOUR_HINTS.test(text) ? "behavioural" : TECH_HINTS.test(text) ? "technical" : "domain",
    priority: priorities.get(text) || inferPriority(text)
  }));

  return {
    title: titleLine.replace(/^(title|role)\s*:\s*/i, "").slice(0, 80),
    seniority: inferSeniority(jd),
    location: locationLine,
    responsibilities: extractResponsibilities(jd),
    requirements
  };
}

function extractRequirementLines(lines) {
  const items = [];
  let section = "";
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    const heading = line.replace(/[:\-]+$/, "");
    if (NICE_HEADING.test(heading) && heading.length < 80) {
      section = "nice";
      continue;
    }
    if (REQUIREMENT_HEADING.test(heading) && heading.length < 80) {
      section = "must";
      continue;
    }
    if (RESPONSIBILITY_HEADING.test(heading) && heading.length < 80) {
      section = "responsibility";
      continue;
    }

    const bullet = line.match(/^(?:[-*]|\d+[.)])\s*(.+)$/)?.[1]?.trim();
    if (!bullet || bullet.length < 8 || bullet.length > 260) continue;
    if (section === "responsibility" && !MUST_HINTS.test(bullet) && !TECH_HINTS.test(bullet) && !BEHAVIOUR_HINTS.test(bullet)) continue;
    items.push({ text: bullet, priority: section === "nice" || NICE_HINTS.test(bullet) ? "nice" : "must" });
  }
  return items;
}

function splitRequirementFragments(line) {
  return line
    .split(/;|\s-\s/)
    .map((part) => part.replace(/^(?:[-*]|\d+[.)])\s*/, "").trim())
    .filter((part) => part.length > 8 && part.length < 260);
}

function addRequirement(requirementTexts, priorities, text, priority) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned || requirementTexts.length >= 12) return;
  if (requirementTexts.some((existing) => similar(existing, cleaned))) return;
  requirementTexts.push(cleaned);
  priorities.set(cleaned, priority);
}

function inferPriority(text) {
  return NICE_HINTS.test(text) && !MUST_HINTS.test(text) ? "nice" : "must";
}

function inferSeniority(jd) {
  if (/\b(staff|principal|head of|director)\b/i.test(jd)) return "senior leadership";
  if (/\b(senior|lead|5\+|6\+|7\+|8\+)\b/i.test(jd)) return "senior";
  if (/\b(junior|entry|graduate|0-2)\b/i.test(jd)) return "junior";
  if (/\b(manager|management)\b/i.test(jd)) return "management";
  return "mid-level";
}

function extractResponsibilities(jd) {
  const picked = sentences(jd)
    .filter((line) => /\b(build|design|develop|own|lead|ship|collaborat|maintain|improve|create|deliver)\b/i.test(line))
    .slice(0, 6);
  return picked.length ? picked : ["Use the job description as the source of truth and clarify missing scope during interviews."];
}

function similar(a, b) {
  const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const left = normalize(a);
  const right = normalize(b);
  return left.includes(right) || right.includes(left);
}
