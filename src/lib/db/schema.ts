import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const gameTypeEnum = pgEnum("game_type", [
  "open_gym",
  "league",
  "tournament",
]);

export const clipStatusEnum = pgEnum("clip_status", [
  "uploading",
  "processing",
  "ready",
  "failed",
]);

export const pinLabelEnum = pgEnum("pin_label", [
  "longest_rally",
  "best_dig",
  "super_spike",
]);

export const downloadQualityEnum = pgEnum("download_quality", [
  "playback",
  "original",
]);

export const clipAiStatusEnum = pgEnum("clip_ai_status", [
  "pending",
  "done",
  "failed",
]);

export const venues = pgTable("venues", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
});

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  venueId: uuid("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "restrict" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  type: gameTypeEnum("type").notNull(),
});

export const clips = pgTable("clips", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  originalKey: text("original_key").notNull(),
  playbackKey: text("playback_key"),
  posterKey: text("poster_key"),
  durationMs: integer("duration_ms"),
  status: clipStatusEnum("status").notNull().default("uploading"),
  tagsLocked: boolean("tags_locked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clipAiTags = pgTable(
  "clip_ai_tags",
  {
    clipId: uuid("clip_id")
      .primaryKey()
      .references(() => clips.id, { onDelete: "cascade" }),
    status: clipAiStatusEnum("status").notNull().default("pending"),
    summary: text("summary"),
    actions: jsonb("actions").$type<
      { type: string; start_s: number; who: string; outcome: string }[]
    >(),
    rallyCount: integer("rally_count"),
    longestRallyS: real("longest_rally_s"),
    highlightScore: integer("highlight_score"),
    tags: jsonb("tags").$type<string[]>(),
    mappedTagSlugs: jsonb("mapped_tag_slugs").$type<string[]>(),
    model: text("model"),
    error: text("error"),
    taggedAt: timestamp("tagged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("clip_ai_tags_status").on(table.status)],
);

export const tags = pgTable("tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
});

export const clipTags = pgTable(
  "clip_tags",
  {
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.clipId, table.tagId] })],
);

export const sessionPins = pgTable(
  "session_pins",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    label: pinLabelEnum("label"),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.clipId] }),
    uniqueIndex("session_pins_game_position").on(table.gameId, table.position),
    uniqueIndex("session_pins_game_label").on(table.gameId, table.label),
  ],
);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  auth0Sub: text("auth0_sub").notNull().unique(),
  email: text("email"),
  name: text("name"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.clipId] })],
);

export const watchEvents = pgTable(
  "watch_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    ipHash: text("ip_hash").notNull(),
    watchedOn: date("watched_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("watch_events_visitor_clip_day").on(
      table.visitorId,
      table.clipId,
      table.watchedOn,
    ),
    index("watch_events_ip_day").on(table.ipHash, table.watchedOn),
    index("watch_events_visitor_day").on(table.visitorId, table.watchedOn),
  ],
);

export const downloadEvents = pgTable(
  "download_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    quality: downloadQualityEnum("quality").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("download_events_user_created").on(table.userId, table.createdAt)],
);

export const venuesRelations = relations(venues, ({ many }) => ({
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  venue: one(venues, {
    fields: [games.venueId],
    references: [venues.id],
  }),
  clips: many(clips),
  pins: many(sessionPins),
}));

export const clipsRelations = relations(clips, ({ one, many }) => ({
  game: one(games, {
    fields: [clips.gameId],
    references: [games.id],
  }),
  clipTags: many(clipTags),
  aiTag: one(clipAiTags, {
    fields: [clips.id],
    references: [clipAiTags.clipId],
  }),
  pins: many(sessionPins),
  favorites: many(favorites),
}));

export const clipAiTagsRelations = relations(clipAiTags, ({ one }) => ({
  clip: one(clips, {
    fields: [clipAiTags.clipId],
    references: [clips.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  clipTags: many(clipTags),
}));

export const clipTagsRelations = relations(clipTags, ({ one }) => ({
  clip: one(clips, {
    fields: [clipTags.clipId],
    references: [clips.id],
  }),
  tag: one(tags, {
    fields: [clipTags.tagId],
    references: [tags.id],
  }),
}));

export const sessionPinsRelations = relations(sessionPins, ({ one }) => ({
  game: one(games, {
    fields: [sessionPins.gameId],
    references: [games.id],
  }),
  clip: one(clips, {
    fields: [sessionPins.clipId],
    references: [clips.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  favorites: many(favorites),
  downloads: many(downloadEvents),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  clip: one(clips, {
    fields: [favorites.clipId],
    references: [clips.id],
  }),
}));

export const SEED_TAGS = [
  { slug: "ace", name: "Ace" },
  { slug: "serve", name: "Serve" },
  { slug: "dig", name: "Dig" },
  { slug: "set", name: "Set" },
  { slug: "spike", name: "Spike" },
  { slug: "block", name: "Block" },
  { slug: "rally", name: "Rally" },
  { slug: "save", name: "Save" },
  { slug: "funny", name: "Funny" },
] as const;

export const PIN_LABELS = [
  { slug: "longest_rally", name: "Longest rally" },
  { slug: "best_dig", name: "Best dig" },
  { slug: "super_spike", name: "Super spike" },
] as const;

export const MAX_PINS_PER_SESSION = 3;
export const ANON_WATCH_LIMIT = 7;
// Shared connections (gym wifi, a family, incognito on the same network) get more headroom.
export const ANON_IP_WATCH_LIMIT = 25;
export const FREE_DOWNLOADS_PER_WEEK = 3;
export const PRO_MONTHLY_PRICE_USD = 5;

export type GameType = (typeof gameTypeEnum.enumValues)[number];
export type ClipStatus = (typeof clipStatusEnum.enumValues)[number];
export type ClipAiStatus = (typeof clipAiStatusEnum.enumValues)[number];
export type PinLabel = (typeof pinLabelEnum.enumValues)[number];
export type DownloadQuality = (typeof downloadQualityEnum.enumValues)[number];
