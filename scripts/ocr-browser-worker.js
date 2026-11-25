// Serve packaged language data as application JSON, then unwrap it for Tesseract.
const appFetch = self.fetch.bind(self);
self.fetch = async (resource, options) => {
  const url = new URL(typeof resource === "string" ? resource : resource.url ?? resource.href, self.location.href);
  const language = url.pathname.match(/^\/pdf-engine\/ocr\/(eng|ind)\.traineddata\.gz$/);
  if (!language || url.origin !== self.location.origin) return appFetch(resource, options);
  const model = await appFetch(new URL(language[1] + ".model.json", url), options);
  if (!model.ok) throw new Error("OCR language data is unavailable.");
  const bytes = Uint8Array.from(atob(await model.json()), char => char.charCodeAt(0));
  return new Response(bytes);
};
self.importScripts("./worker.min.js");