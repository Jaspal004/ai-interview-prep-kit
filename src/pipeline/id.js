export function slugify(value, fallback = "item") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return slug || fallback;
}

export function stableId(prefix, index) {
  return `${prefix}${index + 1}`;
}
