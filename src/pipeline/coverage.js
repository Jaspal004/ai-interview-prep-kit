export function checkCoverage(requirements, questions) {
  const covered = new Set();
  for (const question of questions) {
    for (const id of question.requirement_ids || []) covered.add(id);
  }
  return requirements
    .filter((requirement) => requirement.priority === "must" && !covered.has(requirement.id))
    .map((requirement) => requirement.id);
}
