import test from "node:test";
import assert from "node:assert/strict";
import { checkCoverage } from "../src/pipeline/coverage.js";
import { buildSchedule } from "../src/pipeline/schedule.js";
import { validateKit } from "../src/pipeline/validate.js";

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
