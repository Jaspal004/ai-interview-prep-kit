import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const DB_NAME = process.env.MONGODB_DB || "trao_interview_prep";
const empty = { users: [], kits: [] };

let mongoClient;
let mongoDb;

async function getMongoDb() {
  if (!process.env.MONGODB_URI) return null;
  if (!mongoClient) {
    mongoClient = new MongoClient(process.env.MONGODB_URI);
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    await mongoDb.collection("users").createIndex({ email_lower: 1 }, { unique: true });
    await mongoDb.collection("kits").createIndex({ user_id: 1, updated_at: -1 });
  }
  return mongoDb;
}

export async function readDb() {
  const db = await getMongoDb();
  if (db) {
    return {
      users: await db.collection("users").find({}).map(fromMongo).toArray(),
      kits: await db.collection("kits").find({}).map(fromMongo).toArray()
    };
  }
  try {
    return JSON.parse(await readFile(DB_PATH, "utf8"));
  } catch {
    return structuredClone(empty);
  }
}

export async function writeDb(dbState) {
  const db = await getMongoDb();
  if (db) {
    await db.collection("users").deleteMany({});
    await db.collection("kits").deleteMany({});
    if (dbState.users.length) await db.collection("users").insertMany(dbState.users.map(toMongoUser));
    if (dbState.kits.length) await db.collection("kits").insertMany(dbState.kits.map(toMongo));
    return;
  }
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DB_PATH, JSON.stringify(dbState, null, 2));
}

export async function createUser(user) {
  const db = await getMongoDb();
  const next = { id: randomUUID(), ...user, email_lower: user.email.toLowerCase(), created_at: new Date().toISOString() };
  if (db) {
    try {
      await db.collection("users").insertOne(toMongoUser(next));
      return withoutMongoOnly(next);
    } catch (error) {
      if (error.code === 11000) throw new Error("Email already registered");
      throw error;
    }
  }

  const fileDb = await readDb();
  if (fileDb.users.some((item) => item.email.toLowerCase() === user.email.toLowerCase())) throw new Error("Email already registered");
  fileDb.users.push(withoutMongoOnly(next));
  await writeDb(fileDb);
  return withoutMongoOnly(next);
}

export async function findUserByEmail(email) {
  const db = await getMongoDb();
  if (db) {
    const user = await db.collection("users").findOne({ email_lower: String(email).toLowerCase() });
    return user ? fromMongo(user) : null;
  }
  const fileDb = await readDb();
  return fileDb.users.find((user) => user.email.toLowerCase() === String(email).toLowerCase()) || null;
}

export async function findUserById(id) {
  const db = await getMongoDb();
  if (db) {
    const user = await db.collection("users").findOne({ id });
    return user ? fromMongo(user) : null;
  }
  const fileDb = await readDb();
  return fileDb.users.find((user) => user.id === id) || null;
}

export async function listKits(userId) {
  const db = await getMongoDb();
  if (db) {
    return db.collection("kits").find({ user_id: userId }).sort({ updated_at: -1 }).map(fromMongo).toArray();
  }
  const fileDb = await readDb();
  return fileDb.kits.filter((kit) => kit.user_id === userId).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function createKit(userId, input, kit) {
  const now = new Date().toISOString();
  const item = { id: randomUUID(), user_id: userId, input, kit, status: "ready", created_at: now, updated_at: now };
  const db = await getMongoDb();
  if (db) {
    await db.collection("kits").insertOne(toMongo(item));
    return item;
  }
  const fileDb = await readDb();
  fileDb.kits.push(item);
  await writeDb(fileDb);
  return item;
}

export async function getKit(userId, id) {
  const db = await getMongoDb();
  if (db) {
    const kit = await db.collection("kits").findOne({ id, user_id: userId });
    return kit ? fromMongo(kit) : null;
  }
  const fileDb = await readDb();
  return fileDb.kits.find((kit) => kit.id === id && kit.user_id === userId) || null;
}

export async function updateKit(userId, id, patch) {
  const db = await getMongoDb();
  const updated_at = new Date().toISOString();
  if (db) {
    const result = await db.collection("kits").findOneAndUpdate(
      { id, user_id: userId },
      { $set: { ...patch, updated_at } },
      { returnDocument: "after" }
    );
    return result ? fromMongo(result) : null;
  }

  const fileDb = await readDb();
  const index = fileDb.kits.findIndex((kit) => kit.id === id && kit.user_id === userId);
  if (index === -1) return null;
  fileDb.kits[index] = { ...fileDb.kits[index], ...patch, updated_at };
  await writeDb(fileDb);
  return fileDb.kits[index];
}

export async function deleteKit(userId, id) {
  const db = await getMongoDb();
  if (db) {
    const result = await db.collection("kits").deleteOne({ id, user_id: userId });
    return result.deletedCount > 0;
  }
  const fileDb = await readDb();
  const before = fileDb.kits.length;
  fileDb.kits = fileDb.kits.filter((kit) => !(kit.id === id && kit.user_id === userId));
  await writeDb(fileDb);
  return fileDb.kits.length !== before;
}

function toMongo(value) {
  const copy = { ...value };
  delete copy._id;
  return copy;
}

function toMongoUser(value) {
  return toMongo({ ...value, email_lower: value.email_lower || value.email.toLowerCase() });
}

function fromMongo(value) {
  const copy = { ...value };
  delete copy._id;
  return withoutMongoOnly(copy);
}

function withoutMongoOnly(value) {
  const copy = { ...value };
  delete copy.email_lower;
  return copy;
}
