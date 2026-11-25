/**
 * Gemini AI Client - Official @google/genai SDK
 * 
 * PRIVACY NOTICE:
 * - All AI requests are sent directly from your browser to Google Gemini
 * - NoHoldr does NOT proxy, inspect, or store any AI requests
 * - Your API key is stored only in your browser's localStorage
 * - Your content is NOT collected or used by NoHoldr
 */

import { GoogleGenAI, Type, type GenerateContentParameters, type GenerateContentResponse, type Part } from "@google/genai";

const STORAGE_KEY = "noholdr_gemini_api_key";
const KEY_CHANGE_EVENT = "noholdr:gemini-key-change";
export const GEMINI_MODEL = "gemini-3-flash-preview";

// API Key Management
export function getApiKey(): string | null {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(STORAGE_KEY); }
    catch { return null; }
}

export function setApiKey(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, key);
    window.dispatchEvent(new Event(KEY_CHANGE_EVENT));
}

export function clearApiKey(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(KEY_CHANGE_EVENT));
}

export function hasApiKey(): boolean {
    return !!getApiKey();
}

export function subscribeToApiKey(onChange: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
        if (event.key === STORAGE_KEY || event.key === null) {
            onChange();
        }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(KEY_CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(KEY_CHANGE_EVENT, onChange);
    };
}

function createClient() {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("Add your Gemini API key in AI tools first.");
  return new GoogleGenAI({ apiKey, httpOptions: { timeout: 20_000 } });
}

async function generate(client: GoogleGenAI, params: GenerateContentParameters) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (reason) {
      const status = reason instanceof Error && "status" in reason ? Number(reason.status) : 0;
      if (attempt >= 2 || ![500, 502, 503, 504].includes(status)) throw reason;
      await new Promise(resolve => setTimeout(resolve, 750 * 2 ** attempt));
    }
  }
}

function responseText(response: GenerateContentResponse) {
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned no text. Try rephrasing the request.");
  return text;
}

export async function generateChat(messages: { role: "user" | "assistant"; content: string }[]) {
  return responseText(await generate(createClient(), {
    model: GEMINI_MODEL,
    contents: messages.map(message => ({ role: message.role === "user" ? "user" : "model", parts: [{ text: message.content }] })),
  }));
}

export async function generateWithSystem(systemInstruction: string, prompt: string) {
  return responseText(await generate(createClient(), {
    model: GEMINI_MODEL, config: { systemInstruction }, contents: prompt,
  }));
}

const imageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]);
export const AI_IMAGE_ACCEPT = Array.from(imageTypes).join(",");
export const AI_IMAGE_HINT = "PNG, JPEG, WebP, HEIC, or HEIF up to 12 MB.";

export function validAiImage(file: File) {
  return imageTypes.has(file.type) && file.size > 0 && file.size <= 12 * 1024 * 1024;
}

async function imagePart(file: File): Promise<Part> {
  if (!validAiImage(file)) throw new Error(AI_IMAGE_HINT);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(new Error("Could not read this image."));
    reader.onabort = () => reject(new Error("Image reading was interrupted."));
    reader.readAsDataURL(file);
  });
  return { inlineData: { mimeType: file.type, data } };
}

export async function describeImage(file: File, prompt: string) {
  const client = createClient();
  return responseText(await generate(client, {
    model: GEMINI_MODEL, contents: [{ role: "user", parts: [await imagePart(file), { text: prompt }] }],
  }));
}

export type ImageMetadata = { title: string; description: string; keywords: string[] };
export async function generateImageMetadata(file: File): Promise<ImageMetadata> {
  const client = createClient();
  const text = responseText(await generate(client, {
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [await imagePart(file), { text: "Write accurate metadata for this image. Use a title under 60 characters, a description under 160 characters, and up to 10 useful keywords." }] }],
    config: { responseMimeType: "application/json", responseSchema: {
      type: Type.OBJECT,
      required: ["title", "description", "keywords"],
      properties: {
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    } },
  }));
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !("title" in parsed) || !("description" in parsed) || !("keywords" in parsed) ||
    typeof parsed.title !== "string" || !parsed.title.trim() || typeof parsed.description !== "string" ||
    !Array.isArray(parsed.keywords) || !parsed.keywords.every(word => typeof word === "string")) {
    throw new Error("Gemini returned incomplete image metadata.");
  }
  return { title: parsed.title.trim(), description: parsed.description.trim(), keywords: parsed.keywords };
}

export function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "The request could not finish.";
  const status = "status" in error ? Number(error.status) : undefined;
  if ((status === 400 && error.message.includes("API_KEY")) || status === 401) return "Check your Gemini API key in AI tools.";
  if (status === 403) return "This API key does not have access to Gemini.";
  if (status === 429) return "Gemini quota or rate limit reached. Try again later.";
  if (status === 404) return "The Gemini model is unavailable for this key.";
  if (status && status >= 500) return "Gemini is temporarily unavailable. Try again.";
  if (status) return "Gemini rejected the request. Check the input and try again.";
  if (error.name === "AbortError" || error.name === "TimeoutError") return "Gemini took too long to respond. Try again.";
  if (error instanceof SyntaxError) return "Gemini returned invalid metadata. Try again.";
  return error.message;
}
