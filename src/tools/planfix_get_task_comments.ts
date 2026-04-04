import { z } from "zod";
import {
  getCommentUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { CommentResponse } from "../types.js";

const GetTaskCommentsInputSchema = z.object({
  taskId: z.number().describe("Planfix task ID"),
  offset: z
    .number()
    .optional()
    .describe("Pagination offset (default: 0)"),
});

const GetTaskCommentsOutputSchema = z.object({
  comments: z.array(z.any()),
  totalCount: z.number(),
  hasMore: z.boolean(),
  nextOffset: z.number(),
  error: z.string().optional(),
});

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof GetTaskCommentsOutputSchema>> {
  const { taskId, offset = 0 } = GetTaskCommentsInputSchema.parse(args);

  try {
    const result = await planfixRequest<{
      comments?: CommentResponse[];
      pagination?: { count: number; pageNumber: number; pageSize: number };
    }>({
      path: `task/${taskId}/comments/list`,
      body: {
        offset,
        pageSize: 100,
        fields: "id,dateTime,owner,description,body,type,files,recipients",
      },
    });

    const comments = (result.comments || []).map((c) => {
      const rawBody = c.body || c.description || "";
      return {
        id: c.id,
        dateTime: c.dateTime,
        author: c.owner?.name,
        authorType: c.owner?.type,
        type: c.type,
        body: stripHtml(rawBody),
        files: c.files?.map((f) => ({
          id: f.id,
          name: f.name,
          size: f.size,
        })),
        recipients: Array.isArray(c.recipients) ? c.recipients.map((r) => r.name).filter(Boolean) : [],
        url: getCommentUrl(taskId, c.id),
      };
    });

    const totalCount = result.pagination?.count ?? comments.length;
    const nextOffset = offset + 100;
    const hasMore = nextOffset < totalCount;

    return {
      comments,
      totalCount,
      hasMore,
      nextOffset: hasMore ? nextOffset : totalCount,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfix_get_task_comments] Error: ${errorMessage}`);
    return {
      comments: [],
      totalCount: 0,
      hasMore: false,
      nextOffset: 0,
      error: errorMessage,
    };
  }
}

export default getToolWithHandler({
  name: "planfix_get_task_comments",
  description:
    "Get comments/correspondence on a Planfix task. Returns comment text (HTML stripped to plain text), author, date, and attached files. Paginated (100 per page).",
  inputSchema: GetTaskCommentsInputSchema,
  outputSchema: GetTaskCommentsOutputSchema,
  handler,
});
