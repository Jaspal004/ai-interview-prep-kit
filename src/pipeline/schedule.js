export function buildSchedule(daysAvailable, requirements, questions) {
  const days = clampDays(daysAvailable);
  const buckets = Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    focus: "",
    question_ids: [],
    minutes: 0
  }));

  const byRequirement = new Map();
  for (const question of questions) {
    for (const reqId of question.requirement_ids || []) {
      if (!byRequirement.has(reqId)) byRequirement.set(reqId, []);
      byRequirement.get(reqId).push(question);
    }
  }

  const orderedRequirements = [...requirements].sort((a, b) => priorityWeight(b) - priorityWeight(a));
  let cursor = 0;
  for (const requirement of orderedRequirements) {
    const matches = byRequirement.get(requirement.id) || [];
    for (const question of matches) {
      const target = buckets[Math.min(cursor, buckets.length - 1)];
      if (!target.question_ids.includes(question.id)) target.question_ids.push(question.id);
    }
    cursor = Math.min(cursor + 1, buckets.length - 1);
  }

  for (const question of questions) {
    if (buckets.some((day) => day.question_ids.includes(question.id))) continue;
    buckets[cursor % buckets.length].question_ids.push(question.id);
    cursor += 1;
  }

  const requirementMap = new Map(requirements.map((req) => [req.id, req]));
  const questionMap = new Map(questions.map((question) => [question.id, question]));
  return {
    days_available: days,
    days: buckets.map((day, index) => {
      const dayRequirements = day.question_ids
        .flatMap((id) => questionMap.get(id)?.requirement_ids || [])
        .map((id) => requirementMap.get(id))
        .filter(Boolean);
      return {
        ...day,
        focus: focusFor(dayRequirements, index),
        minutes: Math.max(30, day.question_ids.length * 25 + (index < Math.ceil(days / 3) ? 20 : 0))
      };
    })
  };
}

function clampDays(days) {
  const parsed = Number.parseInt(days, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(60, Math.max(1, parsed));
}

function priorityWeight(requirement) {
  let weight = requirement.priority === "must" ? 10 : 1;
  if (requirement.kind === "technical") weight += 3;
  if (requirement.kind === "behavioural") weight += 2;
  if (/\b(senior|lead|architecture|scale|security)\b/i.test(requirement.text)) weight += 3;
  return weight;
}

function focusFor(requirements, index) {
  if (!requirements.length) return index === 0 ? "Review role context and identify unknowns" : "Light review and self-check";
  const must = requirements.filter((req) => req.priority === "must");
  const pool = must.length ? must : requirements;
  const kinds = [...new Set(pool.map((req) => req.kind))].join(" and ");
  return `${kinds || "general"} preparation: ${pool.slice(0, 2).map((req) => req.text).join("; ")}`.slice(0, 180);
}
