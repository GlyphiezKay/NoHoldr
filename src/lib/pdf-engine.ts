export type PdfEngineOperation = "protect" | "unlock" | "repair" | "optimize";

type EngineReply = { output: ArrayBuffer; warnings: number } | { error: string };

export async function runPdfEngine(file: File, operation: PdfEngineOperation, password = "") {
  const input = await file.arrayBuffer();
  const worker = new Worker("/pdf-engine/qpdf-worker.mjs", { type: "module" });
  try {
    return await new Promise<{ blob: Blob; warnings: number }>((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<EngineReply>) => {
        if ("error" in data) reject(new Error(data.error));
        else resolve({ blob: new Blob([data.output], { type: "application/pdf" }), warnings: data.warnings });
      };
      worker.onerror = event => {
        event.preventDefault();
        reject(new Error("The local PDF engine could not start. Reload and try again."));
      };
      worker.onmessageerror = () => reject(new Error("The PDF engine returned an unreadable response."));
      worker.postMessage({ input, operation, password }, [input]);
    });
  } finally {
    worker.terminate();
  }
}