export type OfficeFormat = "word" | "excel" | "powerpoint" | "html" | "archive";

export const officeExtensions = {
  word: ["docx", "doc", "odt", "rtf"],
  excel: ["xlsx", "xls", "ods"],
  powerpoint: ["pptx", "ppt", "odp"],
  html: ["html", "htm"],
  archive: ["pdf"],
} as const;

let engineQueue = Promise.resolve();

async function convert(file: File, mode: OfficeFormat, report: (message: string) => void) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowed: readonly string[] = officeExtensions[mode];
  if (!allowed.includes(ext)) throw new Error("Choose a supported file type: " + allowed.join(", ") + ".");
  if (!file.size || file.size > 80 * 1024 * 1024) throw new Error("Choose a non-empty file up to 80 MB.");
  if (mode === "archive") {
    const { createArchivePdf } = await import("./pdf-archive");
    return createArchivePdf(file, report);
  }
  if (!("Suspending" in WebAssembly)) throw new Error("Use an updated desktop Chromium browser with WebAssembly JSPI.");
  const bytes = await file.arrayBuffer();
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.title = "Local document conversion";
  frame.src = "/pdf-engine/office/engine.html?v=0.2.0";
  const origin = location.origin;
  const id = crypto.randomUUID();
  const name = "input." + ext;
  const args = ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", "/tmp/out", "/tmp/in/" + name];
  report("Starting the document engine… The first run may take longer.");
  return await new Promise<Blob>((resolve, reject) => {
    let sent = false;
    const cleanup = () => {
      clearTimeout(timeout);
      window.removeEventListener("message", handle);
      frame.remove();
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Conversion timed out. Try a smaller document."));
    }, 180_000);
    function handle(event: MessageEvent) {
      if (event.source !== frame.contentWindow || event.origin !== origin || !event.data) return;
      const reply = event.data;
      if (reply.type === "lo-ready" && !sent) {
        sent = true;
        report("Converting the document in your browser…");
        frame.contentWindow?.postMessage({ type: "lo-run", id, args, files: [{ name, bytes }] }, origin, [bytes]);
      } else if (reply.type === "lo-done" && reply.id === id) {
        const output = reply.files?.find((file: { name: string }) => file.name === "input.pdf");
        cleanup();
        if (!(output?.bytes instanceof ArrayBuffer) || !output.bytes.byteLength) {
          reject(new Error("The document engine could not export this file. Check that it opens without a password."));
          return;
        }
        resolve(new Blob([output.bytes], { type: "application/pdf" }));
      }
    }
    window.addEventListener("message", handle);
    document.body.append(frame);
  });
}

export function officeToPdf(file: File, mode: OfficeFormat, report: (message: string) => void) {
  const result = engineQueue.then(() => convert(file, mode, report));
  engineQueue = result.then(() => {}, () => {});
  return result;
}
