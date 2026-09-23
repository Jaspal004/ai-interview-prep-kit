const STOP_WORDS = new Set([
  "and", "or", "the", "with", "for", "from", "that", "this", "will", "you",
  "your", "our", "are", "have", "has", "into", "about", "using", "work",
  "team", "role", "experience", "years", "strong", "good", "great"
]);

export function cleanText(value, max = 12000) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function sentences(text) {
  return String(text || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}

export function keywords(text, limit = 8) {
  const counts = new Map();
  for (const word of String(text || "").toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) || []) {
    if (!STOP_WORDS.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

export function unique(items) {
  return [...new Set(items.filter(Boolean))];
}
