import fs from "fs";
import path from "path";
import { createDocument } from "~/lib/db/queries/documents.server";
import { getConfigDir } from "~/lib/helpers.server";
import type { Route } from "./+types/api.projects.$projectId.import.file";

function inferExtension(contentType: string): string {
  const value = String(contentType || "").toLowerCase();
  if (value.includes("pdf")) return ".pdf";
  if (value.includes("json")) return ".json";
  if (value.includes("html")) return ".html";
  if (value.includes("xml")) return ".xml";
  if (value.includes("markdown")) return ".md";
  if (value.includes("plain")) return ".txt";
  return ".bin";
}

function sanitizeFilename(value: string): string {
  return (
    String(value || "source")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "source"
  );
}

function inferTextFromBuffer(
  buffer: Buffer,
  mimeType: string,
  filename: string
): string {
  const type = String(mimeType || "").toLowerCase();
  const lowerName = String(filename || "").toLowerCase();
  if (
    type.includes("text/") ||
    type.includes("json") ||
    type.includes("xml") ||
    type.includes("yaml") ||
    type.includes("csv") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".json") ||
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".xml") ||
    lowerName.endsWith(".yml") ||
    lowerName.endsWith(".yaml") ||
    lowerName.endsWith(".html") ||
    lowerName.endsWith(".htm")
  ) {
    return buffer.toString("utf8");
  }
  return "";
}

export async function action({ request, params }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const projectId = params.projectId;
  const filename = String(body.filename || "uploaded-file").trim();
  const mimeType = String(body.mimeType || "application/octet-stream").trim();
  const base64 = String(body.contentBase64 || "").trim();
  if (!base64) {
    return Response.json(
      { error: "contentBase64 is required" },
      { status: 400 }
    );
  }
  const buffer = Buffer.from(base64, "base64");
  const capturesDir = path.join(getConfigDir(), "captures", projectId);
  if (!fs.existsSync(capturesDir)) {
    fs.mkdirSync(capturesDir, { recursive: true });
  }
  const extension =
    path.extname(filename) || inferExtension(mimeType);
  const storedName = `${sanitizeFilename(path.basename(filename, path.extname(filename)))}-${Date.now()}${extension}`;
  const capturePath = path.join(capturesDir, storedName);
  fs.writeFileSync(capturePath, buffer);

  let content = inferTextFromBuffer(buffer, mimeType, filename);
  if (
    !content &&
    (mimeType.includes("pdf") || filename.toLowerCase().endsWith(".pdf"))
  ) {
    try {
      const pdfParseModule = await import("pdf-parse");
      const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
      const parsed = await pdfParse(buffer);
      content = String(parsed.text || "")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      content = "";
    }
  }
  const document = await createDocument(projectId, {
    collectionId: body.collectionId,
    title: body.title || filename,
    sourceType: "file",
    sourceUri: `file://${capturePath}`,
    storageUri: capturePath,
    content: content || `[Binary file stored at ${capturePath}]`,
    metadata: {
      filename,
      mimeType,
      bytes: buffer.length,
      capturePath,
      extractedTextLength: content.length,
    },
  });
  return Response.json({ document }, { status: 201 });
}
