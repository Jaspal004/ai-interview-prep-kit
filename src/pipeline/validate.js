export function validateKit(kit) {
  const parsed = kit;
  requireObject(parsed, "kit");
  requireObject(parsed.source, "source");
  requireObject(parsed.company_brief, "company_brief");
  requireObject(parsed.role, "role");
  requireObject(parsed.schedule, "schedule");
  requireObject(parsed.coverage, "coverage");
  requireArray(parsed.source.pages_used, "source.pages_used");
  requireArray(parsed.company_brief.sources, "company_brief.sources");
  requireArray(parsed.role.responsibilities, "role.responsibilities");
  requireArray(parsed.role.requirements, "role.requirements");
  requireArray(parsed.questions, "questions");
  requireArray(parsed.flashcards, "flashcards");
  requireArray(parsed.schedule.days, "schedule.days");
  requireArray(parsed.coverage.uncovered_requirement_ids, "coverage.uncovered_requirement_ids");

  if (!Number.isInteger(parsed.source.jd_chars)) throw new Error("source.jd_chars must be an integer");
  if (!Number.isInteger(parsed.schedule.days_available)) throw new Error("schedule.days_available must be an integer");
  if (!Number.isInteger(parsed.coverage.passes)) throw new Error("coverage.passes must be an integer");

  const questionIds = new Set(parsed.questions.map((question) => question.id));
  const requirementIds = new Set(parsed.role.requirements.map((requirement) => requirement.id));

  for (const requirement of parsed.role.requirements) {
    if (!requirement.id || typeof requirement.text !== "string") throw new Error("Invalid requirement structure");
    if (!["technical", "behavioural", "domain"].includes(requirement.kind)) throw new Error("Invalid requirement kind");
    if (!["must", "nice"].includes(requirement.priority)) throw new Error("Invalid requirement priority");
  }

  for (const question of parsed.questions) {
    if (!question.id || !Array.isArray(question.requirement_ids)) throw new Error("Invalid question structure");
    if (!["technical", "behavioural", "system-design", "company-fit"].includes(question.category)) throw new Error("Invalid question category");
    if (!Number.isInteger(question.difficulty) || question.difficulty < 1 || question.difficulty > 3) throw new Error("Question difficulty must be 1 to 3");
    for (const id of question.requirement_ids) {
      if (!requirementIds.has(id)) throw new Error(`Question ${question.id} references missing requirement ${id}`);
    }
  }

  for (const card of parsed.flashcards) {
    if (!card.id || typeof card.front !== "string" || typeof card.back !== "string" || !Array.isArray(card.requirement_ids)) {
      throw new Error("Invalid flashcard structure");
    }
  }

  for (const day of parsed.schedule.days) {
    if (!Number.isInteger(day.day) || typeof day.focus !== "string" || !Array.isArray(day.question_ids)) throw new Error("Invalid schedule day structure");
    if (!Number.isInteger(day.minutes)) throw new Error("Schedule minutes must be integer minutes");
    for (const id of day.question_ids) {
      if (!questionIds.has(id)) throw new Error(`Schedule day ${day.day} references missing question ${id}`);
    }
  }

  if (parsed.schedule.days.length !== parsed.schedule.days_available) {
    throw new Error("Schedule day count must equal days_available");
  }
  return parsed;
}

function requireObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${name} must be an object`);
}

function requireArray(value, name) {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
}
