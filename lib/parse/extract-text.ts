export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFileError";
  }
}

type SupportedKind = "pdf" | "docx" | "txt";

function detectKind(filename: string, mimeType: string): SupportedKind {
  const name = filename.toLowerCase();
  if (name.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (
    name.endsWith(".docx") ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (name.endsWith(".txt") || name.endsWith(".md") || mimeType.startsWith("text/")) {
    return "txt";
  }
  if (name.endsWith(".doc")) {
    throw new UnsupportedFileError(
      "Legacy .doc files aren't supported. Export as PDF or .docx and try again.",
    );
  }
  throw new UnsupportedFileError("Upload a PDF, DOCX, or TXT file.");
}

/**
 * Extract plain text from an uploaded resume. The file itself is never
 * persisted — only the text that comes out of here — so this runs in-process on
 * the upload request rather than through blob storage.
 */
export async function extractResumeText(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  if (buffer.byteLength === 0) throw new UnsupportedFileError("That file is empty.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new UnsupportedFileError("That file is larger than 5MB.");
  }

  const kind = detectKind(filename, mimeType);
  const text = await extractByKind(kind, buffer);
  const normalized = normalizeWhitespace(text);

  if (normalized.length < 200) {
    throw new UnsupportedFileError(
      kind === "pdf"
        ? "We couldn't read any text from that PDF — it may be a scan or an image. Try exporting a text-based PDF, or paste the text instead."
        : "That file doesn't contain enough text to analyze.",
    );
  }

  return normalized;
}

async function extractByKind(kind: SupportedKind, buffer: ArrayBuffer): Promise<string> {
  switch (kind) {
    case "pdf": {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const document = await getDocumentProxy(new Uint8Array(buffer));
      const { text } = await extractText(document, { mergePages: true });
      return Array.isArray(text) ? text.join("\n") : text;
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      return value;
    }
    case "txt":
      return new TextDecoder().decode(buffer);
  }
}

/**
 * PDF extraction leaves ragged spacing and stray bullet glyphs that confuse the
 * claim extractor into treating one bullet as several. Collapse it into clean
 * lines while preserving the line breaks that separate bullets.
 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/ /g, " ")
    // Common PDF bullet glyphs at the start of a line.
    .replace(/^[\s]*[•▪◦‣∙·—–-]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line.length > 0 || lines[index - 1]?.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
