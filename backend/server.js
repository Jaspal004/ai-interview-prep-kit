import "dotenv/config";
import express from "express";
import cors from "cors";
import session from "express-session";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import { createKit, createUser, deleteKit, findUserByEmail, findUserById, getKit, listKits, updateKit } from "./store.js";
import { generateKit, regenerateSection } from "../src/pipeline/index.js";
import { validateKit } from "../src/pipeline/validate.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const webOrigin = process.env.WEB_ORIGIN || "http://localhost:3000";
const isProduction = process.env.NODE_ENV === "production";

app.set("trust proxy", 1);
app.use(cors({ origin: webOrigin, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/auth/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) return res.status(400).json({ error: "Email and an 8+ character password are required." });
    const password_hash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, password_hash });
    req.session.userId = user.id;
    res.json(publicUser(user));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/auth/login", async (req, res) => {
  const user = await findUserByEmail(req.body.email || "");
  if (!user || !(await bcrypt.compare(req.body.password || "", user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  req.session.userId = user.id;
  res.json(publicUser(user));
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/me", requireAuth, (req, res) => res.json(publicUser(req.user)));

app.get("/kits", requireAuth, async (req, res) => {
  const kits = await listKits(req.user.id);
  res.json(kits.map((kit) => ({ ...kit, kit: summarizeKit(kit.kit) })));
});

app.post("/kits", requireAuth, async (req, res) => {
  try {
    const { jd, company_url, days } = req.body;
    const kit = await generateKit({ jd, company_url, days });
    const saved = await createKit(req.user.id, { jd, company_url, days }, kit);
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message, code: error.code || "KIT_GENERATION_FAILED" });
  }
});

app.post("/kits/batch", requireAuth, async (req, res) => {
  const cases = Array.isArray(req.body.cases) ? req.body.cases : [];
  const results = [];
  for (const item of cases) {
    try {
      const kit = await generateKit({ jd: item.jd, company_url: item.company_url, days: item.days });
      results.push(await createKit(req.user.id, { jd: item.jd, company_url: item.company_url, days: item.days }, kit));
    } catch (error) {
      results.push({ id: item.id, status: "failed", error: { message: error.message, code: error.code || "KIT_GENERATION_FAILED" } });
    }
  }
  res.json(results);
});

app.get("/kits/:id", requireAuth, async (req, res) => {
  const kit = await getKit(req.user.id, req.params.id);
  if (!kit) return res.status(404).json({ error: "Kit not found." });
  res.json(kit);
});

app.put("/kits/:id", requireAuth, async (req, res) => {
  try {
    const kit = validateKit(req.body.kit);
    const saved = await updateKit(req.user.id, req.params.id, { kit });
    if (!saved) return res.status(404).json({ error: "Kit not found." });
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post("/kits/:id/regenerate", requireAuth, async (req, res) => {
  try {
    const item = await getKit(req.user.id, req.params.id);
    if (!item) return res.status(404).json({ error: "Kit not found." });
    const kit = validateKit(regenerateSection(item.kit, req.body.section));
    const saved = await updateKit(req.user.id, req.params.id, { kit });
    res.json(saved);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/kits/:id", requireAuth, async (req, res) => {
  res.json({ ok: await deleteKit(req.user.id, req.params.id) });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: "Session expired or missing." });
  const user = await findUserById(req.session.userId);
  if (!user) return res.status(401).json({ error: "Session expired or invalid." });
  req.user = user;
  next();
}

function publicUser(user) {
  return { id: user.id, email: user.email };
}

function summarizeKit(kit) {
  return {
    source: kit.source,
    coverage: kit.coverage,
    schedule: kit.schedule,
    question_count: kit.questions.length,
    flashcard_count: kit.flashcards.length
  };
}
