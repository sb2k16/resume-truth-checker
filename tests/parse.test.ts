import { describe, expect, it } from "vitest";
import {
  MAX_UPLOAD_BYTES,
  UnsupportedFileError,
  extractResumeText,
  normalizeWhitespace,
} from "@/lib/parse/extract-text";

const RESUME = `Souvik Example
Senior Software Engineer

EXPERIENCE

AWS — Software Development Engineer
• Designed a distributed ingestion platform processing 10M events/day.
• Reduced operational incidents by 70%.
• Implemented Java services for the control plane.
• Led migration to OpenSearch across four teams.

EDUCATION
B.Tech, Computer Science
`;

function encode(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("normalizeWhitespace", () => {
  it("strips bullet glyphs so one bullet stays one line", () => {
    const result = normalizeWhitespace("• Reduced latency\n▪ Built cache\n- Led migration");
    expect(result).toBe("Reduced latency\nBuilt cache\nLed migration");
  });

  it("collapses runs of spaces and non-breaking spaces", () => {
    expect(normalizeWhitespace("Reduced    latency by 40%")).toBe("Reduced latency by 40%");
  });

  it("collapses long blank runs but keeps paragraph breaks", () => {
    expect(normalizeWhitespace("A\n\n\n\n\nB")).toBe("A\n\nB");
  });

  it("normalises Windows line endings", () => {
    expect(normalizeWhitespace("A\r\nB")).toBe("A\nB");
  });
});

describe("extractResumeText", () => {
  it("reads a plain text resume", async () => {
    const text = await extractResumeText(encode(RESUME), "resume.txt", "text/plain");
    expect(text).toContain("Reduced operational incidents by 70%.");
    expect(text).not.toContain("•");
  });

  it("accepts text by mime type when the extension is missing", async () => {
    const text = await extractResumeText(encode(RESUME), "resume", "text/plain");
    expect(text).toContain("AWS");
  });

  it("rejects an empty file", async () => {
    await expect(extractResumeText(new ArrayBuffer(0), "resume.txt", "text/plain")).rejects.toThrow(
      UnsupportedFileError,
    );
  });

  it("rejects a file over the size cap", async () => {
    const oversized = new ArrayBuffer(MAX_UPLOAD_BYTES + 1);
    await expect(extractResumeText(oversized, "resume.pdf", "application/pdf")).rejects.toThrow(
      /larger than 5MB/,
    );
  });

  it("rejects legacy .doc with a fix the user can act on", async () => {
    await expect(extractResumeText(encode(RESUME), "resume.doc", "")).rejects.toThrow(
      /Export as PDF or \.docx/,
    );
  });

  it("rejects an unsupported type", async () => {
    await expect(extractResumeText(encode(RESUME), "resume.pages", "")).rejects.toThrow(
      /PDF, DOCX, or TXT/,
    );
  });

  it("rejects a document with too little text to analyze", async () => {
    await expect(extractResumeText(encode("Hi there"), "resume.txt", "text/plain")).rejects.toThrow(
      /enough text/,
    );
  });
});
