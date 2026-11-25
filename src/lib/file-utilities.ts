import JSZip from "jszip";

export const fileStem = (name: string) => name.replace(/(?<=.)\.[^.]+$/, "");
export const safeFileName = (name: string) => name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim().replace(/[. ]+$/, "") || "file";

export function uniqueFileName(name: string, used: Set<string>) {
  const safe = safeFileName(name);
  const stem = fileStem(safe);
  const ext = safe.slice(stem.length);
  let candidate = safe;
  for (let number = 2; used.has(candidate.toLowerCase()); number++) candidate = `${stem} (${number})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export async function createFileZip(files: { name: string; blob: Blob }[], progress?: (percent: number) => void) {
  const zip = new JSZip();
  const used = new Set<string>();
  for (const { name, blob } of files) zip.file(uniqueFileName(name, used), blob);
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" }, meta => progress?.(Math.round(meta.percent)));
}

export async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
