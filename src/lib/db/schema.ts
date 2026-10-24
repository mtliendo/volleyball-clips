import { relations } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
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

export const venuesRelations = relations(venues, ({ many }) => ({
  games: many(games),
}));

export const gamesRelations = relations(games, ({ one, many }) => ({
  venue: one(venues, {
    fields: [games.venueId],
    references: [venues.id],
  }),
  clips: many(clips),
}));

export const clipsRelations = relations(clips, ({ one, many }) => ({
  game: one(games, {
    fields: [clips.gameId],
    references: [games.id],
  }),
  clipTags: many(clipTags),
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

export const SEED_TAGS = [
  { slug: "spike", name: "Spike" },
  { slug: "block", name: "Block" },
  { slug: "dig", name: "Dig" },
  { slug: "ace", name: "Ace" },
  { slug: "set", name: "Set" },
  { slug: "save", name: "Save" },
  { slug: "rally", name: "Rally" },
] as const;

export type GameType = (typeof gameTypeEnum.enumValues)[number];
export type ClipStatus = (typeof clipStatusEnum.enumValues)[number];
