export const GEMINI_AI_TAG_MODEL = "gemini-3.8-flash";

export const AI_ACTION_TYPES = [
  "serve",
  "ace",
  "service_error",
  "pass",
  "set",
  "attack/kill",
  "attack_error",
  "block",
  "dig",
  "free_ball",
  "rally_end",
] as const;

export const AI_WHO = ["POV player", "teammate", "opponent", "unknown"] as const;

export type AiActionType = (typeof AI_ACTION_TYPES)[number];
export type AiWho = (typeof AI_WHO)[number];

export type AiAction = {
  type: AiActionType;
  start_s: number;
  who: AiWho;
  outcome: string;
};

export type AiTagResult = {
  summary: string;
  actions: AiAction[];
  rally_count: number;
  longest_rally_s: number;
  highlight_score: number;
  tags: string[];
};

export const AI_TAG_PROMPT = `This video is a short indoor volleyball clip filmed first-person (POV) from smart glasses (Meta glasses) worn by one player, the "POV player". The camera is their eyes: hands/arms seen at the bottom of the frame are the POV player's. Audio includes whistles, ball contacts, and voices.

Analyze the whole clip and return strict JSON:
- summary: one plain sentence describing what happens.
- actions: chronological list of volleyball contacts/events. type must be one of serve, ace, service_error, pass, set, attack/kill, attack_error, block, dig, free_ball, rally_end. start_s = seconds from clip start. who = "POV player" (the camera wearer), "teammate", "opponent", or "unknown" if you can't tell. outcome = a few words (e.g. "kill", "kept in play", "into net", "point to us").
- rally_count: number of rallies in the clip.
- longest_rally_s: duration in seconds of the longest rally.
- highlight_score: 1-5 (5 = must-watch highlight).
- tags: 2-6 short lowercase tags. Prefer the site vocabulary when it fits: spike, set, block, rally, funny, ace, serve, dig, save. You may add one extra short tag if something important is missing (for example "kill" or "collision").

Rules:
- Only report what you actually see or hear. Do not invent contacts.
- Use type "attack/kill" only when that attack ends the rally (the ball is unreturnable or lands for a point). A hard swing that is dug or stays in play is not a kill. Do not label it attack/kill.
- Be conservative with who. If jersey, court side, or body position does not make it clear, use "unknown". Do not guess teammate vs opponent.
- Hands/arms at the bottom of the frame are the POV player. A player facing the camera is usually someone else, not the wearer.
- Prefer "unknown" over a wrong who.
- Do not use filler tags like "volleyball", "pov", "indoor", "recreational", or "smart glasses".`;

export const AI_TAG_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: { type: "STRING" },
    actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING", enum: [...AI_ACTION_TYPES] },
          start_s: { type: "NUMBER" },
          who: { type: "STRING", enum: [...AI_WHO] },
          outcome: { type: "STRING" },
        },
        required: ["type", "start_s", "who", "outcome"],
      },
    },
    rally_count: { type: "INTEGER" },
    longest_rally_s: { type: "NUMBER" },
    highlight_score: { type: "INTEGER" },
    tags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: [
    "summary",
    "actions",
    "rally_count",
    "longest_rally_s",
    "highlight_score",
    "tags",
  ],
} as const;

const GENERIC_AI_TAGS = new Set([
  "volleyball",
  "pov",
  "indoor",
  "indoor-volleyball",
  "indoor volleyball",
  "recreational",
  "smart-glasses",
  "smart glasses",
  "point",
]);

export const AI_TAG_SYNONYMS: Record<string, string> = {
  ace: "ace",
  serve: "serve",
  service: "serve",
  dig: "dig",
  set: "set",
  spike: "spike",
  kill: "spike",
  attack: "spike",
  "attack-kill": "spike",
  "attack/kill": "spike",
  block: "block",
  stuff: "block",
  rally: "rally",
  "long-rally": "rally",
  "long rally": "rally",
  "longest-rally": "rally",
  save: "save",
  pancake: "save",
  funny: "funny",
  celebration: "funny",
  collision: "funny",
};

const ACTION_TO_SLUG: Partial<Record<AiActionType, string>> = {
  ace: "ace",
  "attack/kill": "spike",
  block: "block",
};

export function slugifyAiTag(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function canonicalizeAiTag(value: string) {
  const trimmed = value.trim().toLowerCase();
  const slugged = slugifyAiTag(trimmed);
  return AI_TAG_SYNONYMS[trimmed] ?? AI_TAG_SYNONYMS[slugged] ?? slugged;
}

export function mapAiTagsToCatalog(
  result: Pick<AiTagResult, "tags" | "actions" | "longest_rally_s">,
  catalogSlugs: Iterable<string>,
) {
  const known = new Set(
    [...catalogSlugs].map((slug) => slugifyAiTag(slug)).filter(Boolean),
  );
  const mapped = new Set<string>();

  for (const raw of result.tags) {
    if (GENERIC_AI_TAGS.has(raw.trim().toLowerCase()) || GENERIC_AI_TAGS.has(slugifyAiTag(raw))) {
      continue;
    }
    const slug = canonicalizeAiTag(raw);
    if (known.has(slug)) {
      mapped.add(slug);
    }
  }

  for (const action of result.actions) {
    const slug = ACTION_TO_SLUG[action.type];
    if (slug && known.has(slug)) {
      mapped.add(slug);
    }
  }

  if (result.longest_rally_s >= 10 && known.has("rally")) {
    mapped.add("rally");
  }

  return [...mapped];
}

function isAiActionType(value: unknown): value is AiActionType {
  return typeof value === "string" && (AI_ACTION_TYPES as readonly string[]).includes(value);
}

function isAiWho(value: unknown): value is AiWho {
  return typeof value === "string" && (AI_WHO as readonly string[]).includes(value);
}

export function parseAiTagResult(input: unknown): AiTagResult {
  if (!input || typeof input !== "object") {
    throw new Error("AI tag result is not an object");
  }
  const value = input as Record<string, unknown>;
  if (typeof value.summary !== "string" || !value.summary.trim()) {
    throw new Error("AI tag result is missing a summary");
  }
  if (!Array.isArray(value.actions)) {
    throw new Error("AI tag result is missing actions");
  }
  if (!Array.isArray(value.tags)) {
    throw new Error("AI tag result is missing tags");
  }

  const actions: AiAction[] = value.actions.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`AI action ${index} is invalid`);
    }
    const action = item as Record<string, unknown>;
    if (!isAiActionType(action.type)) {
      throw new Error(`AI action ${index} has an unknown type`);
    }
    if (!isAiWho(action.who)) {
      throw new Error(`AI action ${index} has an unknown who`);
    }
    const start = Number(action.start_s);
    if (!Number.isFinite(start) || start < 0) {
      throw new Error(`AI action ${index} has an invalid start_s`);
    }
    return {
      type: action.type,
      start_s: start,
      who: action.who,
      outcome: typeof action.outcome === "string" ? action.outcome : "",
    };
  });

  const rallyCount = Number(value.rally_count);
  const longestRallyS = Number(value.longest_rally_s);
  const highlightScore = Number(value.highlight_score);
  if (!Number.isInteger(rallyCount) || rallyCount < 0) {
    throw new Error("AI tag result has an invalid rally_count");
  }
  if (!Number.isFinite(longestRallyS) || longestRallyS < 0) {
    throw new Error("AI tag result has an invalid longest_rally_s");
  }
  if (!Number.isInteger(highlightScore) || highlightScore < 1 || highlightScore > 5) {
    throw new Error("AI tag result has an invalid highlight_score");
  }

  return {
    summary: value.summary.trim(),
    actions,
    rally_count: rallyCount,
    longest_rally_s: longestRallyS,
    highlight_score: highlightScore,
    tags: value.tags
      .filter((tag): tag is string => typeof tag === "string")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

export type ClipAiTagRecord = {
  clipId: string;
  status: "pending" | "done" | "failed";
  summary: string | null;
  actions: AiAction[] | null;
  rallyCount: number | null;
  longestRallyS: number | null;
  highlightScore: number | null;
  tags: string[] | null;
  mappedTagSlugs: string[] | null;
  model: string | null;
  error: string | null;
  taggedAt: Date | null;
};

export function aiTagRecordFromResult(input: {
  clipId: string;
  result: AiTagResult;
  mappedTagSlugs: string[];
  model: string;
}): ClipAiTagRecord {
  return {
    clipId: input.clipId,
    status: "done",
    summary: input.result.summary,
    actions: input.result.actions,
    rallyCount: input.result.rally_count,
    longestRallyS: input.result.longest_rally_s,
    highlightScore: input.result.highlight_score,
    tags: input.result.tags,
    mappedTagSlugs: input.mappedTagSlugs,
    model: input.model,
    error: null,
    taggedAt: new Date(),
  };
}
