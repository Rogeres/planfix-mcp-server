import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { getToolWithHandler, log } from "../helpers.js";
import {
  PLANFIX_BASE_URL,
  PLANFIX_HEADERS,
} from "../config.js";

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "text/plain": ".txt",
  "text/html": ".html",
  "text/csv": ".csv",
  "application/zip": ".zip",
  "application/x-rar-compressed": ".rar",
  "application/json": ".json",
};

const TEXT_MIME_PREFIXES = ["text/", "application/json", "application/xml", "application/csv"];

function isTextMime(mimeType: string): boolean {
  return TEXT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

const DownloadFileInputSchema = z.object({
  fileId: z.number().describe("Planfix file ID (from task or comment attachments)"),
  saveDir: z
    .string()
    .optional()
    .describe("Directory to save the file (default: ~/Downloads/planfix/)"),
});

const DownloadFileOutputSchema = z.object({
  filePath: z.string().optional(),
  fileName: z.string().optional(),
  sizeBytes: z.number().optional(),
  mimeType: z.string().optional(),
  textContent: z.string().optional(),
  base64Content: z.string().optional(),
  error: z.string().optional(),
});

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof DownloadFileOutputSchema>> {
  const { fileId, saveDir } = DownloadFileInputSchema.parse(args);
  const targetDir = saveDir || path.join(os.homedir(), "Downloads", "planfix");

  try {
    // Ensure directory exists
    await fs.mkdir(targetDir, { recursive: true });

    const response = await fetch(`${PLANFIX_BASE_URL}file/${fileId}/download`, {
      method: "GET",
      headers: {
        Authorization: PLANFIX_HEADERS.Authorization,
        Accept: "*/*",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Extract filename from Content-Disposition header or use fileId
    const contentDisposition = response.headers.get("content-disposition");
    let fileName = "";
    if (contentDisposition) {
      // Try UTF-8 filename first (filename*=UTF-8''...)
      const utf8Match = contentDisposition.match(
        /filename\*=(?:UTF-8|utf-8)''(.+?)(?:;|$)/i,
      );
      if (utf8Match) {
        fileName = decodeURIComponent(utf8Match[1]);
      } else {
        // Fall back to regular filename
        const match = contentDisposition.match(
          /filename[^;=\n]*=["']?([^"';\n]+)/,
        );
        if (match) {
          fileName = match[1].trim();
        }
      }
    }

    const mimeType =
      response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());

    // If no filename was extracted, build one from fileId + mime extension
    if (!fileName) {
      const ext = MIME_TO_EXT[mimeType.split(";")[0].trim()] || "";
      fileName = `file_${fileId}${ext}`;
    }

    const filePath = path.join(targetDir, fileName);
    await fs.writeFile(filePath, buffer);

    log(
      `[planfix_download_file] Downloaded file ${fileId} -> ${filePath} (${buffer.length} bytes)`,
    );

    const result: z.infer<typeof DownloadFileOutputSchema> = {
      filePath,
      fileName,
      sizeBytes: buffer.length,
      mimeType,
    };

    // Return content inline so Claude can use it in the conversation
    if (isTextMime(mimeType) && buffer.length < 500_000) {
      result.textContent = buffer.toString("utf-8");
    } else if (buffer.length < 5_000_000) {
      // For binary files under 5MB, return base64 so Claude can read images/PDFs
      result.base64Content = buffer.toString("base64");
    }

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfix_download_file] Error: ${errorMessage}`);
    return { error: errorMessage };
  }
}

export default getToolWithHandler({
  name: "planfix_download_file",
  description:
    "Download a file attachment from Planfix. Saves to ~/Downloads/planfix/ and returns file content inline (text for text files, base64 for binary) so it can be used directly in the conversation.",
  inputSchema: DownloadFileInputSchema,
  outputSchema: DownloadFileOutputSchema,
  handler,
});
