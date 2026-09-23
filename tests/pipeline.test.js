import test from "node:test";
import assert from "node:assert/strict";
import { checkCoverage } from "../src/pipeline/coverage.js";
import { extractRole } from "../src/pipeline/extract.js";
import { buildSchedule } from "../src/pipeline/schedule.js";
import { validateKit } from "../src/pipeline/validate.js";
import { regenerateSection } from "../src/pipeline/index.js";

const requirements = [
  { id: "r1", text: "Build React interfaces", kind: "technical", priority: "must" },
  { id: "r2", text: "Mentor junior engineers", kind: "behavioural", priority: "must" },
  { id: "r3", text: "GraphQL experience", kind: "technical", priority: "nice" }
];

const questions = [
  { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "p", answer_outline: "a", difficulty: 2 },
  { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "p", answer_outline: "a", difficulty: 2 }
];

test("coverage check reports only uncovered must-have requirements", () => {
  assert.deepEqual(checkCoverage(requirements, questions), []);
  assert.deepEqual(checkCoverage(requirements, questions.slice(0, 1)), ["r2"]);
});

test("schedule spans exactly the requested days with integer minutes and valid question ids", () => {
  const schedule = buildSchedule(4, requirements, questions);
  assert.equal(schedule.days_available, 4);
  assert.equal(schedule.days.length, 4);
  assert.ok(schedule.days.every((day) => Number.isInteger(day.minutes)));
  assert.ok(schedule.days.some((day) => day.question_ids.includes("q1")));
  assert.ok(schedule.days.some((day) => day.question_ids.includes("q2")));
});

test("schedule clamps edge day counts while preserving exact generated length", () => {
  const oneDay = buildSchedule(1, requirements, questions);
  const sixtyDays = buildSchedule(60, requirements, questions);
  const clampedLow = buildSchedule(0, requirements, questions);
  const clampedHigh = buildSchedule(90, requirements, questions);

  assert.equal(oneDay.days.length, 1);
  assert.equal(sixtyDays.days.length, 60);
  assert.equal(clampedLow.days_available, 1);
  assert.equal(clampedHigh.days_available, 60);
  assert.ok(sixtyDays.days.every((day) => Number.isInteger(day.minutes)));
});

test("extractRole honors required and preferred bullet sections", () => {
  const role = extractRole(`Senior Backend Engineer

Requirements:
- 5+ years building Node.js APIs
- Must understand authentication and API security

Preferred:
- Familiarity with Kubernetes
- Bonus points for mentoring engineers`);

  assert.equal(role.requirements.find((req) => /Node\.js APIs/i.test(req.text))?.priority, "must");
  assert.equal(role.requirements.find((req) => /Kubernetes/i.test(req.text))?.priority, "nice");
  assert.equal(role.requirements.find((req) => /mentoring/i.test(req.text))?.kind, "behavioural");
});

test("kit validation enforces schedule references and exact day count", () => {
  const kit = {
    source: { company: "Acme", company_url: "https://example.com", role: "Engineer", location: "", jd_chars: 100, researched_at: new Date().toISOString(), pages_used: [] },
    company_brief: { summary: "", what_they_do: "", sources: [] },
    role: { title: "Engineer", seniority: "mid-level", responsibilities: ["Build"], requirements },
    questions,
    flashcards: [{ id: "f1", front: "front", back: "back", requirement_ids: ["r1"] }],
    schedule: buildSchedule(2, requirements, questions),
    coverage: { uncovered_requirement_ids: [], passes: 1 }
  };
  assert.equal(validateKit(kit).schedule.days.length, 2);
  kit.schedule.days[0].question_ids.push("missing");
  assert.throws(() => validateKit(kit), /missing question/);
});

test("question regeneration preserves edited and manual questions in that category", () => {
  const kit = {
    source: { company: "Acme", company_url: "https://example.com", role: "Engineer", location: "", jd_chars: 100, researched_at: new Date().toISOString(), pages_used: [] },
    company_brief: { summary: "Acme", what_they_do: "Builds developer tools", sources: [] },
    role: { title: "Engineer", seniority: "mid-level", responsibilities: ["Build"], requirements },
    questions: [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "edited prompt", answer_outline: "a", difficulty: 2, state: "edited", pinned: false },
      { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "p", answer_outline: "a", difficulty: 2, state: "generated", pinned: false },
      { id: "q99", requirement_ids: [], category: "technical", prompt: "manual prompt", answer_outline: "a", difficulty: 1, state: "manual", pinned: true }
    ],
    flashcards: [{ id: "f1", front: "front", back: "back", requirement_ids: ["r1"] }],
    schedule: buildSchedule(2, requirements, questions),
    coverage: { uncovered_requirement_ids: [], passes: 1 },
    research_notes: { hiring_notes: "", skipped_sources: [], public_discussion: "", public_discussion_sources: [] }
  };

  const regenerated = regenerateSection(kit, "questions:technical");
  assert.ok(regenerated.questions.some((question) => question.id === "q1" && question.prompt === "edited prompt"));
  assert.ok(regenerated.questions.some((question) => question.id === "q99" && question.prompt === "manual prompt"));
  assert.ok(regenerated.questions.some((question) => question.category === "behavioural"));
});
