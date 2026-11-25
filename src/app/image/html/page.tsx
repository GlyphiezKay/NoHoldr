"use client";

import { ToolFile } from "@/components/layout/tool-file";
import { ToolOutput, useToolExport } from "@/components/layout/tool-output";
import { useState } from "react";
import { Download } from "lucide-react";
import { ToolPanel, ToolWorkspace } from "@/components/layout/tool-workspace";
import { FilePicker } from "@/components/ui/file-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { encodeCanvas, makeImageCanvas } from "@/lib/image-processing";

const elements = new Set("article aside blockquote br div em figcaption figure h1 h2 h3 h4 hr i img li ol p pre s section small span strong table tbody td th thead tr u ul".split(" "));
const dropEntirely = new Set("script style link meta iframe object embed svg math form audio video source template".split(" "));
const properties = "background-color border border-radius box-shadow color display flex flex-direction flex-wrap font-family font-size font-style font-weight gap grid-template-columns height justify-content align-items letter-spacing line-height margin margin-top margin-right margin-bottom margin-left max-height max-width min-height min-width opacity overflow padding padding-top padding-right padding-bottom padding-left text-align text-decoration text-transform vertical-align white-space width".split(" ");

function imageMarkup(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const wrapper = document.createElementNS("http://www.w3.org/1999/xhtml", "div") as HTMLDivElement;
  wrapper.style.cssText = "box-sizing:border-box;width:100%;height:100%;overflow:hidden;background:#fff;color:#181818;font:16px system-ui;padding:24px;";

  function copy(node: Node, parent: HTMLElement) {
    if (node.nodeType === Node.TEXT_NODE) {
      parent.append(document.createTextNode(node.textContent ?? ""));
      return;
    }
    if (!(node instanceof Element)) return;
    const tag = node.localName.toLowerCase();
    if (dropEntirely.has(tag)) return;
    if (!elements.has(tag)) {
      for (const child of node.childNodes) copy(child, parent);
      return;
    }
    const clean = document.createElement(tag);
    const inline = node instanceof HTMLElement ? node.style : undefined;
    for (const name of properties) {
      const value = inline?.getPropertyValue(name);
      if (value && !/[\\();]|url|var|attr|image-set/i.test(value.replace(/rgba?\([\d.,%\s]+\)/gi, ""))) {
        clean.style.setProperty(name, value);
      }
    }
    if (tag === "img") {
      const src = node.getAttribute("src") ?? "";
      if (!/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(src)) return;
      clean.setAttribute("src", src);
      clean.setAttribute("alt", node.getAttribute("alt") ?? "");
    }
    for (const name of ["width", "height", "colspan", "rowspan"]) {
      const value = node.getAttribute(name);
      if (value && /^\d{1,4}$/.test(value)) clean.setAttribute(name, value);
    }
    parent.append(clean);
    for (const child of node.childNodes) copy(child, clean);
  }

  for (const node of template.content.childNodes) copy(node, wrapper);
  return new XMLSerializer().serializeToString(wrapper);
}

export default function HtmlToImage() {
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [html, setHtml] = useState("");
  const output = useToolExport(html);
  const [width, setWidth] = useState("1024");
  const [height, setHeight] = useState("768");
  const [format, setFormat] = useState("png");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function load(files: File[]) {
    if (files.length !== 1 || files[0].size > 2 * 1024 * 1024) {
      setError("Choose one HTML file up to 2 MB.");
      return;
    }
    setError("");
    setStatus("");
    try { setHtml(await files[0].text()); setSourceFile(files[0]); }
    catch { setError("Could not read the HTML source."); }
  }

  async function run() {
    if (busy || !html.trim()) return;
    const w = Number(width), h = Number(height);
    if ([w, h].some(size => !Number.isInteger(size) || size < 100 || size > 4096)) {
      setError("Enter dimensions between 100 and 4,096 pixels.");
      return;
    }
    setError("");
    setStatus("");
    setBusy(true);
    try {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"><foreignObject width="100%" height="100%">' +
        imageMarkup(html) + '</foreignObject></svg>';
      const image = new window.Image();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await image.decode();
      const { canvas, context } = makeImageCanvas(w, h);
      try {
        context.drawImage(image, 0, 0, w, h);
        if (context.getImageData(0, 0, 1, 1).data[3] === 0) throw new Error("This browser could not render the HTML. Try desktop Chrome.");
        const png = await encodeCanvas(canvas, "image/" + format, 0.92);
        output.save(png, "noholdr_html." + (format === "jpeg" ? "jpg" : "png"));
        setStatus("Download ready.");
      } finally {
        canvas.width = canvas.height = 0;
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not render the HTML.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ToolWorkspace category="Image tools" backHref="/image" title="HTML to Image" description="Render local HTML or pasted markup into a PNG or JPEG using basic markup and inline styles.">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <ToolPanel stage="input" title="HTML source" description="Embed images using base64 PNG, JPEG, WebP, or GIF. External files, scripts, and stylesheets are skipped.">
          {sourceFile && <div className="mb-3"><ToolFile blob={sourceFile} name={sourceFile.name} /></div>}
          <FilePicker accept=".html,.htm,text/html" action="Choose HTML file" hint="Or paste markup below." disabled={busy} onFiles={load} />
          <Textarea aria-label="HTML markup" placeholder="<h1>Your headline</h1>" className="mt-3 min-h-56 font-mono" value={html}
            maxLength={2 * 1024 * 1024} disabled={busy} onChange={event => { setHtml(event.target.value); setSourceFile(null); }} />
        </ToolPanel>
        <ToolPanel stage="settings" title="Image settings">
          <fieldset className="space-y-3" disabled={busy}>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Width (px)<Input className="mt-1" type="number" min="100" max="4096" value={width} onChange={event => setWidth(event.target.value)} /></label>
              <label className="text-sm font-medium">Height (px)<Input className="mt-1" type="number" min="100" max="4096" value={height} onChange={event => setHeight(event.target.value)} /></label>
            </div>
            <label className="block text-sm font-medium">Output format<select className="mt-1 block h-9 w-full rounded border bg-background px-2" value={format} onChange={event => setFormat(event.target.value)}>
              <option value="png">PNG</option><option value="jpeg">JPEG</option>
            </select></label>
          </fieldset>
          <Button size="lg" className="mt-4 w-full" disabled={busy || !html.trim()} onClick={run}><Download />Render image</Button>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          {status && <p role="status" className="mt-3 text-sm text-muted-foreground">{status}</p>}
        </ToolPanel>
        <ToolOutput file={output.file} />
      </div>
    </ToolWorkspace>
  );
}
