import { z } from "zod";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { TaskListItem } from "../types.js";

const GetContactTasksInputSchema = z.object({
  contactId: z.number().describe("Planfix contact/counterparty ID"),
  templateId: z
    .number()
    .optional()
    .describe("Optional: filter by task template ID (e.g. Deals, Conclusions, Appeals)"),
});

const GetContactTasksOutputSchema = z.object({
  tasks: z.array(z.any()),
  totalCount: z.number(),
  error: z.string().optional(),
});

interface PlanfixFilter {
  type: number;
  operator: string;
  value: string | number;
  field?: number;
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof GetContactTasksOutputSchema>> {
  const { contactId, templateId } = GetContactTasksInputSchema.parse(args);

  try {
    const allTasks: Array<{
      id: number;
      title: string | undefined;
      status: string | undefined;
      statusActive: boolean | undefined;
      template: string | undefined;
      counterparty: string | undefined;
      startDate: string | undefined;
      endDate: string | undefined;
      isOverdue: boolean | undefined;
      assignees: Array<string | undefined> | undefined;
      url: string;
    }> = [];

    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const filters: PlanfixFilter[] = [
        {
          type: 7, // by counterparty
          operator: "equal",
          value: `contact:${contactId}`,
        },
      ];

      if (templateId) {
        filters.push({
          type: 51, // by template
          operator: "equal",
          value: templateId,
        });
      }

      const result = await planfixRequest<{
        tasks?: TaskListItem[];
        pagination?: { count: number };
      }>({
        path: "task/list",
        body: {
          offset,
          pageSize: 100,
          fields:
            "id,name,status,template,counterparty,startDateTime,endDateTime,assignees,isOverdued",
          filters,
        },
      });

      const tasks = result.tasks || [];
      for (const t of tasks) {
        allTasks.push({
          id: t.id,
          title: t.name || t.title,
          status: t.status?.name,
          statusActive: t.status?.isActive,
          template: t.template?.name,
          counterparty: t.counterparty?.name,
          startDate: t.startDateTime,
          endDate: t.endDateTime,
          isOverdue: t.isOverdued,
          assignees: t.assignees?.users?.map((u) => u.name),
          url: getTaskUrl(t.id),
        });
      }

      offset += 100;
      hasMore = tasks.length === 100;
    }

    return {
      tasks: allTasks,
      totalCount: allTasks.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfix_get_contact_tasks] Error: ${errorMessage}`);
    return {
      tasks: [],
      totalCount: 0,
      error: errorMessage,
    };
  }
}

export default getToolWithHandler({
  name: "planfix_get_contact_tasks",
  description:
    "Get ALL tasks associated with a counterparty/client. Auto-paginates to fetch everything. Optionally filter by task template (Deals, Conclusions, Appeals, etc.).",
  inputSchema: GetContactTasksInputSchema,
  outputSchema: GetContactTasksOutputSchema,
  handler,
});
