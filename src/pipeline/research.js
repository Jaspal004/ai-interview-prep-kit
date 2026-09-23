import { cleanText, keywords, unique } from "./text.js";

const DEFAULT_TIMEOUT = Number(process.env.FETCH_TIMEOUT_MS || 7000);
const MAX_CRAWL_PAGES = Number(process.env.MAX_CRAWL_PAGES || 8);
const LINK_HINTS = /(about|company|careers|jobs|hiring|interview|process|handbook|engineering|blog|culture|values|people|work)/i;

export async function researchCompany(companyUrl, options = {}) {
  const started = new Date().toISOString();
  const result = {
    ok: true,
    companyUrl,
    researchedAt: started,
    pagesUsed: [],
    skippedSources: [],
    companyName: inferCompanyName(companyUrl),
    whatTheyDo: "",
    hiringNotes: "",
    publicDiscussion: "",
    publicDiscussionSources: []
  };

  let base;
  try {
    base = validateExternalUrl(companyUrl, options);
  } catch (error) {
    result.ok = false;
    result.skippedSources.push({ url: companyUrl, reason: error.message });
    return result;
  }

  if (!(await allowedByRobots(base))) {
    result.skippedSources.push({ url: base.href, reason: "Blocked by robots.txt" });
    return result;
  }

  const seen = new Set();
  const queue = [base.href];
  const pages = [];

  while (queue.length && pages.length < MAX_CRAWL_PAGES) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    await delay(150);
    const fetched = await fetchText(url);
    if (!fetched.ok) {
      result.skippedSources.push({ url, reason: fetched.error });
      continue;
    }
    pages.push(fetched);
    result.pagesUsed.push(url);
    for (const link of rankLinks(extractLinks(fetched.html, url), base).slice(0, 12)) {
      if (!seen.has(link) && queue.length < 30) queue.push(link);
    }
  }

  const about = pages.find((page) => /about|company|values|culture/i.test(page.url)) || pages[0];
  const hiring = pages.find((page) => /career|job|hiring|interview|process|handbook/i.test(page.url + " " + page.text));

  result.companyName = companyNameFromPages(pages) || result.companyName;
  result.whatTheyDo = summarizePage(about?.text, "No clear company description was discoverable from the reachable pages.");
  result.hiringNotes = hiring ? summarizePage(hiring.text, "Hiring process page was thin.") : "No dedicated hiring or interview process page was discovered during crawl.";
  const discussion = await findPublicDiscussion(result.companyName, result.skippedSources);
  result.publicDiscussion = discussion.summary;
  result.publicDiscussionSources = discussion.sources;
  return result;
}

export function validateExternalUrl(value, options = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs are supported");
  const allowPrivate = options.allowPrivate ?? (process.env.ALLOW_PRIVATE_NETWORK_FETCH === "true" || process.env.NODE_ENV !== "production");
  if (!allowPrivate && isPrivateHost(url.hostname)) throw new Error("Private and loopback addresses are disabled in production");
  return url;
}

async function allowedByRobots(base) {
  try {
    const robots = new URL("/robots.txt", base);
    const res = await fetchWithTimeout(robots.href, { timeout: 2500 });
    if (!res.ok) return true;
    const text = await res.text();
    return !text.split(/\n/).some((line) => /^disallow:\s*\/\s*$/i.test(line.trim()));
  } catch {
    return true;
  }
}

async function fetchText(url, attempt = 1) {
  try {
    const res = await fetchWithTimeout(url, { timeout: DEFAULT_TIMEOUT });
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 3) {
      await delay(250 * attempt * attempt);
      return fetchText(url, attempt + 1);
    }
    if (!res.ok) return { ok: false, url, error: `HTTP ${res.status}` };
    const type = res.headers.get("content-type") || "";
    if (!/text\/html|text\/plain|application\/xhtml/i.test(type)) return { ok: false, url, error: `Unsupported content type: ${type}` };
    const html = (await res.text()).slice(0, 750000);
    return { ok: true, url, html, text: cleanText(html, 18000) };
  } catch (error) {
    if (attempt < 3) {
      await delay(250 * attempt * attempt);
      return fetchText(url, attempt + 1);
    }
    return { ok: false, url, error: error.message };
  }
}

function fetchWithTimeout(url, { timeout }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "TraoInterviewPrepBot/1.0" } })
    .finally(() => clearTimeout(timer));
}

function extractLinks(html, pageUrl) {
  const links = [];
  const pattern = /<a\s+[^>]*href=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const url = new URL(match[1], pageUrl);
      url.hash = "";
      links.push(url.href);
    } catch {}
  }
  return unique(links);
}

function rankLinks(links, base) {
  return links
    .filter((link) => {
      const url = new URL(link);
      return url.hostname === base.hostname && ["http:", "https:"].includes(url.protocol);
    })
    .sort((a, b) => scoreLink(b) - scoreLink(a));
}

function scoreLink(link) {
  const url = new URL(link);
  let score = LINK_HINTS.test(url.pathname) ? 10 : 0;
  score -= url.pathname.split("/").length;
  return score;
}

function summarizePage(text, fallback) {
  const parts = cleanText(text, 4000).split(/(?<=[.!?])\s+/).filter((line) => line.length > 40);
  return parts.slice(0, 3).join(" ") || fallback;
}

function companyNameFromPages(pages) {
  const title = pages.map((page) => page.html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]).find(Boolean);
  return title ? cleanText(title, 100).split(/[|\-–]/)[0].trim() : "";
}

function inferCompanyName(value) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/(^\w|-\w)/g, (letter) => letter.replace("-", " ").toUpperCase());
  } catch {
    return "Unknown company";
  }
}

async function findPublicDiscussion(companyName, skippedSources) {
  if (!companyName || companyName === "Unknown company") {
    return { summary: "No public discussion search was possible because the company name was unknown.", sources: [] };
  }

  const sources = [];
  const notes = [];
  const query = `${companyName} interview hiring`;

  await searchHackerNews(query, sources, notes, skippedSources);
  await searchReddit(query, sources, notes, skippedSources);

  if (!notes.length) {
    return {
      summary: "No relevant public discussion of this company's interview process was found across accessible no-key sources.",
      sources
    };
  }

  return {
    summary: `Public discussion signals found: ${notes.slice(0, 5).join("; ")}`,
    sources
  };
}

async function searchHackerNews(query, sources, notes, skippedSources) {
  const url = `https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=5&query=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, { timeout: 4000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const hits = Array.isArray(data.hits) ? data.hits : [];
    for (const hit of hits.slice(0, 3)) {
      if (!hit.title || !/interview|hiring|career|work|engineer/i.test(hit.title)) continue;
      notes.push(`Hacker News: ${hit.title}`);
      sources.push(hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`);
    }
  } catch (error) {
    skippedSources.push({ url, reason: `Hacker News discussion lookup skipped: ${error.message}` });
  }
}

async function searchReddit(query, sources, notes, skippedSources) {
  const url = `https://www.reddit.com/search.json?limit=5&sort=relevance&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, { timeout: 5000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const children = Array.isArray(data.data?.children) ? data.data.children : [];
    for (const child of children.slice(0, 3)) {
      const post = child.data || {};
      if (!post.title || !/interview|hiring|career|work|engineer|recruit/i.test(post.title)) continue;
      notes.push(`Reddit: ${post.title}`);
      sources.push(post.permalink ? `https://www.reddit.com${post.permalink}` : `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`);
    }
  } catch (error) {
    skippedSources.push({ url, reason: `Reddit discussion lookup skipped: ${error.message}` });
  }
}

function isPrivateHost(hostname) {
  return /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1)/i.test(hostname);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
