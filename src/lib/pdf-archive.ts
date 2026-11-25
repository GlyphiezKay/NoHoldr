import { PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { canvasBytes, openPdf, renderPdfCanvas } from "./pdf-render";
import { pdfBytesToBlob } from "./pdf-utils";

// Compact ICC Profiles, sRGB-v2-micro, CC0-1.0.
const srgbProfile = "AAAByGxjbXMCEAAAbW50clJHQiBYWVogB+IAAwAUAAkADgAdYWNzcE1TRlQAAAAAc2F3c2N0cmwAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1oYW5knZEAPUCAsD1AdCyBnqUijgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJZGVzYwAAAPAAAABfY3BydAAAAQwAAAAMd3RwdAAAARgAAAAUclhZWgAAASwAAAAUZ1hZWgAAAUAAAAAUYlhZWgAAAVQAAAAUclRSQwAAAWgAAABgZ1RSQwAAAWgAAABgYlRSQwAAAWgAAABgZGVzYwAAAAAAAAAFdVJHQgAAAAAAAAAAAAAAAHRleHQAAAAAQ0MwAFhZWiAAAAAAAADzVAABAAAAARbJWFlaIAAAAAAAAG+gAAA48gAAA49YWVogAAAAAAAAYpYAALeJAAAY2lhZWiAAAAAAAAAkoAAAD4UAALbEY3VydgAAAAAAAAAqAAAAfAD4AZwCdQODBMkGTggSChgMYg70Ec8U9hhqHC4gQySsKWoufjPrObM/1kZXTTZUdlwXZB1shnVWfo2ILJI2nKunjLLbvpnKx9dl5Hfx+f//";
const metadata = '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n' +
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
  '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">' +
  '<pdfaid:part>2</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance>' +
  '</rdf:Description></rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>';

export async function createArchivePdf(file: File, report: (message: string) => void) {
  const task = await openPdf(file);
  try {
    const source = await task.promise;
    const output = await PDFDocument.create({ updateMetadata: false });
    const context = output.context;
    const profile = context.register(context.flateStream(Uint8Array.from(atob(srgbProfile), char => char.charCodeAt(0)), { N: 3 }));
    const intent = context.register(context.obj({
      Type: "OutputIntent", S: "GTS_PDFA1", OutputConditionIdentifier: PDFString.of("sRGB"),
      Info: PDFString.of("sRGB IEC61966-2.1"), DestOutputProfile: profile,
    }));
    output.catalog.set(PDFName.of("OutputIntents"), context.obj([intent]));
    output.catalog.set(PDFName.of("Metadata"), context.register(context.stream(new TextEncoder().encode(metadata), { Type: "Metadata", Subtype: "XML" })));
    const id = PDFHexString.of(crypto.randomUUID().replaceAll("-", ""));
    context.trailerInfo.ID = context.obj([id, id]);
    for (let n = 1; n <= source.numPages; n++) {
      report("Rendering archival page " + n + " of " + source.numPages + "…");
      const page = await source.getPage(n);
      const { canvas, original } = await renderPdfCanvas(page, 3600, 2.5);
      try {
        const image = await output.embedJpg(await (await canvasBytes(canvas, "image/jpeg", 0.92)).arrayBuffer());
        output.addPage([original.width, original.height]).drawImage(image, { x: 0, y: 0, width: original.width, height: original.height });
      } finally {
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    }
    return pdfBytesToBlob(await output.save({ useObjectStreams: false, addDefaultPage: false }));
  } finally {
    await task.destroy().catch(() => {});
  }
}