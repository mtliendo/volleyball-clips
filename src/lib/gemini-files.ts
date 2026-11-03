import { AI_TAG_PROMPT, AI_TAG_RESPONSE_SCHEMA, GEMINI_AI_TAG_MODEL } from "./ai-tags";
import type { GeminiFileRef, GeminiTagClient } from "./ai-tag-pipeline";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com";

type GeminiRequestInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: Uint8Array | string | null;
  timeoutMs?: number;
};

async function geminiRequest(
  url: string,
  init: GeminiRequestInit = {},
): Promise<{ status: number; headers: Headers; body: Uint8Array }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? 120_000);
  try {
    const response = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.headers,
      body: init.body == null ? undefined : typeof init.body === "string" ? init.body : Buffer.from(init.body),
      signal: controller.signal,
    });
    const body = new Uint8Array(await response.arrayBuffer());
    return { status: response.status, headers: response.headers, body };
  } finally {
    clearTimeout(timeout);
  }
}

function decodeJson(body: Uint8Array) {
  return JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>;
}

export function createGeminiTagClient(input: {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof geminiRequest;
}): GeminiTagClient {
  const apiKey = input.apiKey;
  const model = input.model ?? GEMINI_AI_TAG_MODEL;
  const request = input.fetchImpl ?? geminiRequest;

  return {
    async uploadVideo(bytes, fileName) {
      const start = await request(`${GEMINI_API_BASE}/upload/v1beta/files?key=${apiKey}`, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
          "X-Goog-Upload-Header-Content-Type": "video/mp4",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ file: { display_name: fileName } }),
        timeoutMs: 30_000,
      });
      const uploadUrl = start.headers.get("x-goog-upload-url");
      if (start.status >= 400 || !uploadUrl) {
        throw new Error(`Gemini file start failed (${start.status})`);
      }

      const uploaded = await request(uploadUrl, {
        method: "POST",
        headers: {
          "X-Goog-Upload-Offset": "0",
          "X-Goog-Upload-Command": "upload, finalize",
          "Content-Length": String(bytes.byteLength),
        },
        body: bytes,
        timeoutMs: 120_000,
      });
      if (uploaded.status >= 400) {
        throw new Error(`Gemini file upload failed (${uploaded.status})`);
      }

      let file = decodeJson(uploaded.body).file as
        | { name?: string; uri?: string; state?: string }
        | undefined;
      if (!file?.name) {
        throw new Error("Gemini file upload returned no file name");
      }

      for (let i = 0; i < 40 && file.state === "PROCESSING"; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const polled = await request(`${GEMINI_API_BASE}/v1beta/${file.name}?key=${apiKey}`, {
          timeoutMs: 30_000,
        });
        file = decodeJson(polled.body) as { name?: string; uri?: string; state?: string };
      }

      if (file.state && file.state !== "ACTIVE") {
        throw new Error(`Gemini file stayed in state ${file.state}`);
      }
      if (!file.uri || !file.name) {
        throw new Error("Gemini file is missing uri");
      }
      return { name: file.name, uri: file.uri };
    },

    async generateFromFile(file: GeminiFileRef) {
      const body = {
        contents: [
          {
            parts: [
              { file_data: { mime_type: "video/mp4", file_uri: file.uri } },
              { text: AI_TAG_PROMPT },
            ],
          },
        ],
        generationConfig: {
          mediaResolution: "MEDIA_RESOLUTION_LOW",
          responseMimeType: "application/json",
          responseSchema: AI_TAG_RESPONSE_SCHEMA,
          temperature: 0.2,
        },
      };

      let lastError = "Gemini generate failed";
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await request(
          `${GEMINI_API_BASE}/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            timeoutMs: 120_000,
          },
        );
        if (response.status === 200) {
          const json = decodeJson(response.body);
          const parts = (
            json.candidates as
              | { content?: { parts?: { text?: string }[] } }[]
              | undefined
          )?.[0]?.content?.parts;
          const text = parts?.map((part) => part.text ?? "").join("") ?? "";
          if (!text) {
            throw new Error("Gemini returned an empty response");
          }
          return JSON.parse(text) as unknown;
        }
        lastError = `Gemini generate failed (${response.status})`;
        if (response.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 30_000 * (attempt + 1)));
          continue;
        }
        throw new Error(lastError);
      }
      throw new Error(lastError);
    },

    async deleteFile(name) {
      const response = await request(`${GEMINI_API_BASE}/v1beta/${name}?key=${apiKey}`, {
        method: "DELETE",
        timeoutMs: 30_000,
      });
      if (response.status >= 400 && response.status !== 404) {
        throw new Error(`Gemini file delete failed (${response.status})`);
      }
    },
  };
}
