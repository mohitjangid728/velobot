import "server-only";
import matter from "gray-matter";
import type { SourceType } from "@velobot/shared";

export interface ParsedDocument {
  title: string;
  text: string;
}

async function parsePdf(buffer: Buffer): Promise<ParsedDocument> {
  // pdf-parse has no ESM build; require() avoids bundler issues in the Node runtime.
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return { title: "", text: result.text };
}

async function parseDocx(buffer: Buffer): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return { title: "", text: result.value };
}

function parseMarkdown(buffer: Buffer): ParsedDocument {
  const { content, data } = matter(buffer.toString("utf-8"));
  return { title: typeof data.title === "string" ? data.title : "", text: content };
}

function parseText(buffer: Buffer): ParsedDocument {
  return { title: "", text: buffer.toString("utf-8") };
}

export async function parseDocument(type: SourceType, buffer: Buffer): Promise<ParsedDocument> {
  switch (type) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "markdown":
      return parseMarkdown(buffer);
    case "txt":
      return parseText(buffer);
    default:
      throw new Error(`parseDocument does not handle source type "${type}"`);
  }
}
