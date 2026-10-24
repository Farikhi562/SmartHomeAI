// SmartHomeAI deterministic demo seed (runs via `node prisma/seed.ts`).
//
// Design goals:
// - Idempotent: every row id is derived from a sha256 of a stable key, and
//   fixed rows are upserted (events/messages use createMany skipDuplicates —
//   the event log stays append-only even from the seed, FR-004/BR-06).
// - Self-contained demo data: one user, 13 locations across 6 chains,
//   10 items, 15 events spread over the last 10 days, 2 conversations with
//   4 messages (one carrying a pendingAction confirmation card).
// - No LLM involvement: seeded assistant messages carry model=null and canned
//   text so the demo never depends on a provider.
//
// Note: `node` executes this file with type stripping — keep syntax erasable
// (no enums/namespaces) and use explicit .js import specifiers.

import { createHash } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client/index.js";

const prisma = new PrismaClient();

const OWNER_ID = "dev_demo"; // TEXT identity id per schema.prisma users.id
const OWNER_EMAIL = "demo@smarthomeai.local";
const SEED_NAMESPACE = "smarthomeai:seed:";

/** Deterministic UUID-shaped id from a stable key (valid for @db.Uuid columns). */
function uuidFor(key: string): string {
  const hex = createHash("sha256").update(SEED_NAMESPACE + key).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const NOW = Date.now();

function ago(days: number, hours = 0, minutes = 0): Date {
  return new Date(NOW - (((days * 24 + hours) * 60 + minutes) * 60 * 1000));
}

// ── Locations (6 chains, 13 rows) ────────────────────────────────────────────

type SeedLocation = { key: string; name: string; parent?: string; description?: string };

const LOCATIONS: SeedLocation[] = [
  { key: "home", name: "Home", description: "Main residence" },
  { key: "home.bedroom", name: "Bedroom", parent: "home" },
  { key: "home.bedroom.drawer", name: "Drawer", parent: "home.bedroom", description: "Bedroom nightstand drawer" },
  { key: "home.bedroom.wardrobe", name: "Wardrobe", parent: "home.bedroom" },
  { key: "home.living", name: "Living room", parent: "home" },
  { key: "home.living.shelf", name: "Shelf", parent: "home.living", description: "Media shelf" },
  { key: "home.kitchen", name: "Kitchen", parent: "home" },
  { key: "home.kitchen.counter", name: "Counter", parent: "home.kitchen" },
  { key: "home.garage", name: "Garage", parent: "home" },
  { key: "home.garage.toolboard", name: "Toolboard", parent: "home.garage" },
  { key: "office", name: "Office", description: "Home office" },
  { key: "office.desk", name: "Desk", parent: "office" },
  { key: "office.desk.drawer", name: "Drawer", parent: "office.desk", description: "Desk drawer" },
];

const locationId = (key: string): string => uuidFor(`location:${key}`);

// ── Items (10) ───────────────────────────────────────────────────────────────

type SeedItem = { key: string; name: string; category?: string; description?: string };

const ITEMS: SeedItem[] = [
  { key: "keys", name: "Motorcycle keys", category: "electronics", description: "Black fob with a silver keyring" },
  { key: "wallet", name: "Wallet", category: "accessories", description: "Brown leather bifold" },
  { key: "backpack", name: "Blue backpack", category: "bags", description: "40L hiking backpack" },
  { key: "passport", name: "Passport", category: "documents" },
  { key: "headphones", name: "Headphones", category: "electronics", description: "Over-ear, noise cancelling" },
  { key: "cable", name: "Charging cable", category: "electronics", description: "USB-C, 2m" },
  { key: "sunglasses", name: "Sunglasses", category: "accessories" },
  { key: "bottle", name: "Water bottle", category: "kitchen", description: "Steel, 750ml" },
  { key: "laptop-charger", name: "Laptop charger", category: "electronics" },
  { key: "umbrella", name: "Umbrella", category: "accessories", description: "Compact, black" },
];

const itemId = (key: string): string => uuidFor(`item:${key}`);

// ── Events (15, append-only, spread across the last 10 days) ─────────────────

type SeedEvent = { key: string; item: string; location: string; at: Date };

const EVENTS: SeedEvent[] = [
  { key: "e01", item: "keys", location: "home.living.shelf", at: ago(2, 20, 30) },
  { key: "e02", item: "keys", location: "home.garage.toolboard", at: ago(9, 8, 15) },
  { key: "e03", item: "wallet", location: "home.bedroom.drawer", at: ago(1, 19, 0) },
  { key: "e04", item: "wallet", location: "office.desk.drawer", at: ago(8, 9, 45) },
  { key: "e05", item: "backpack", location: "home.bedroom.wardrobe", at: ago(3, 17, 20) },
  { key: "e06", item: "passport", location: "office.desk.drawer", at: ago(5, 11, 0) },
  { key: "e07", item: "headphones", location: "home.living.shelf", at: ago(4, 21, 10) },
  { key: "e08", item: "cable", location: "office.desk.drawer", at: ago(6, 14, 5) },
  { key: "e09", item: "sunglasses", location: "home.kitchen.counter", at: ago(0, 6, 0) },
  { key: "e10", item: "bottle", location: "home.kitchen.counter", at: ago(2, 8, 40) },
  { key: "e11", item: "laptop-charger", location: "office.desk.drawer", at: ago(7, 10, 30) },
  { key: "e12", item: "umbrella", location: "home.garage.toolboard", at: ago(3, 7, 55) },
  { key: "e13", item: "backpack", location: "home.bedroom.drawer", at: ago(1, 9, 10) },
  { key: "e14", item: "headphones", location: "office.desk.drawer", at: ago(5, 18, 25) },
  { key: "e15", item: "sunglasses", location: "home.living.shelf", at: ago(1, 13, 15) },
];

// ── Conversations (2) + messages (4) ────────────────────────────────────────

const C1_AT = ago(1, 20, 0);
const C2_AT = ago(0, 1, 0);
const WALLET_PENDING_AT = ago(0, 0, 45);

const c1 = {
  id: uuidFor("conversation:keys"),
  title: "Where are my motorcycle keys?",
  lastMessageAt: new Date(C1_AT.getTime() + 1500),
  messages: [
    {
      id: uuidFor("message:keys:u"),
      role: "USER" as const,
      content: "Where did I last put my motorcycle keys?",
      createdAt: C1_AT,
    },
    {
      id: uuidFor("message:keys:a"),
      role: "ASSISTANT" as const,
      content:
        "Your motorcycle keys were last recorded on the living room shelf. This is the last recorded location, so it may have been moved since then.",
      intent: "lookup_location",
      status: "COMPLETE" as const,
      createdAt: new Date(C1_AT.getTime() + 1500),
    },
  ],
};

const c2 = {
  id: uuidFor("conversation:wallet"),
  title: "Wallet in the bedroom drawer",
  lastMessageAt: new Date(C2_AT.getTime() + 1500),
  messages: [
    {
      id: uuidFor("message:wallet:u"),
      role: "USER" as const,
      content: "I put my wallet in the bedroom drawer",
      createdAt: C2_AT,
    },
    {
      id: uuidFor("message:wallet:a"),
      role: "ASSISTANT" as const,
      content:
        "Here's what I can save for you: Wallet → Home / Bedroom / Drawer. Confirm on the card and I'll record it — nothing is saved yet.",
      intent: "record_memory",
      status: "PENDING_ACTION" as const,
      pendingAction: {
        id: uuidFor("pending:wallet"),
        type: "record_location",
        payload: {
          item: { existingId: itemId("wallet") },
          location: {
            existingId: locationId("home.bedroom.drawer"),
            name: "Drawer",
            path: "Home / Bedroom / Drawer",
          },
          occurredAt: WALLET_PENDING_AT.toISOString(),
          note: null,
        },
        expiresAt: new Date(C2_AT.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        consumedAt: null,
      },
      createdAt: new Date(C2_AT.getTime() + 1500),
    },
  ],
};

const CONVERSATIONS = [c1, c2];

// ── Run ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // User (dev_demo) + default preferences.
  await prisma.user.upsert({
    where: { id: OWNER_ID },
    create: { id: OWNER_ID, email: OWNER_EMAIL, displayName: "Demo User" },
    update: { email: OWNER_EMAIL, displayName: "Demo User", deletedAt: null },
  });
  await prisma.userPreference.upsert({
    where: { userId: OWNER_ID },
    create: { userId: OWNER_ID },
    update: {},
  });

  // Locations, parents first.
  for (const loc of LOCATIONS) {
    await prisma.location.upsert({
      where: { id: locationId(loc.key) },
      create: {
        id: locationId(loc.key),
        ownerId: OWNER_ID,
        name: loc.name,
        description: loc.description ?? null,
        parentId: loc.parent ? locationId(loc.parent) : null,
      },
      update: {
        name: loc.name,
        description: loc.description ?? null,
        parentId: loc.parent ? locationId(loc.parent) : null,
        archivedAt: null,
      },
    });
  }

  // Items.
  for (const item of ITEMS) {
    await prisma.item.upsert({
      where: { id: itemId(item.key) },
      create: {
        id: itemId(item.key),
        ownerId: OWNER_ID,
        name: item.name,
        description: item.description ?? null,
        category: item.category ?? null,
        createdVia: "USER",
      },
      update: {
        name: item.name,
        description: item.description ?? null,
        category: item.category ?? null,
        archivedAt: null,
        deletedAt: null,
      },
    });
  }

  // Events — append-only table, so only inserts; skipDuplicates keeps re-runs
  // idempotent without ever updating existing rows (FR-004).
  await prisma.itemLocationEvent.createMany({
    data: EVENTS.map((e) => ({
      id: uuidFor(`event:${e.key}`),
      ownerId: OWNER_ID,
      itemId: itemId(e.item),
      locationId: locationId(e.location),
      occurredAt: e.at,
      recordedAt: e.at, // demo rows: recorded when they "happened"
      source: "MANUAL",
      confidence: "CONFIRMED",
    })),
    skipDuplicates: true,
  });

  // Conversations + messages.
  for (const conv of CONVERSATIONS) {
    await prisma.conversation.upsert({
      where: { id: conv.id },
      create: {
        id: conv.id,
        ownerId: OWNER_ID,
        title: conv.title,
        lastMessageAt: conv.lastMessageAt,
      },
      update: { title: conv.title, lastMessageAt: conv.lastMessageAt },
    });
    await prisma.message.createMany({
      data: conv.messages.map((m) => ({
        id: m.id,
        ownerId: OWNER_ID,
        conversationId: conv.id,
        role: m.role,
        content: m.content,
        intent: "intent" in m ? (m.intent ?? null) : null,
        status: "status" in m ? m.status : "COMPLETE",
        pendingAction: "pendingAction" in m ? (m.pendingAction ?? undefined) : undefined,
        model: null, // seeded text is canned — no provider was involved
        latencyMs: null,
        createdAt: m.createdAt,
      })),
      skipDuplicates: true,
    });
  }

  const [locations, items, events, conversations, messages] = await Promise.all([
    prisma.location.count({ where: { ownerId: OWNER_ID } }),
    prisma.item.count({ where: { ownerId: OWNER_ID } }),
    prisma.itemLocationEvent.count({ where: { ownerId: OWNER_ID } }),
    prisma.conversation.count({ where: { ownerId: OWNER_ID } }),
    prisma.message.count({ where: { ownerId: OWNER_ID } }),
  ]);
  // Seed runs as a standalone CLI (node prisma/seed.ts) outside the app runtime,
  // so the structured app logger is not available here.
  // eslint-disable-next-line no-console -- CLI output by design
  console.log(
    `Seed complete for ${OWNER_EMAIL}: ${locations} locations, ${items} items, ` +
      `${events} events, ${conversations} conversations, ${messages} messages.`,
  );
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
