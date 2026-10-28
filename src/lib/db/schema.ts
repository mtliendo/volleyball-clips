import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

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
  pins: many(sessionPins),
  favorites: many(favorites),
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
  { slug: "spike", name: "Spike" },
  { slug: "block", name: "Block" },
  { slug: "dig", name: "Dig" },
  { slug: "ace", name: "Ace" },
  { slug: "set", name: "Set" },
  { slug: "save", name: "Save" },
  { slug: "rally", name: "Rally" },
] as const;

export const PIN_LABELS = [
  { slug: "longest_rally", name: "Longest rally" },
  { slug: "best_dig", name: "Best dig" },
  { slug: "super_spike", name: "Super spike" },
] as const;

export const MAX_PINS_PER_SESSION = 3;
export const ANON_WATCH_LIMIT = 7;
export const FREE_DOWNLOADS_PER_WEEK = 3;
export const PRO_MONTHLY_PRICE_USD = 5;

export type GameType = (typeof gameTypeEnum.enumValues)[number];
export type ClipStatus = (typeof clipStatusEnum.enumValues)[number];
export type PinLabel = (typeof pinLabelEnum.enumValues)[number];
export type DownloadQuality = (typeof downloadQualityEnum.enumValues)[number];
