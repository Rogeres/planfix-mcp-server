import { z } from "zod";
import {
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { TaskFullResponse } from "../types.js";

const GetTaskInputSchema = z.object({
  taskId: z.number().describe("Planfix task ID"),
});

const GetTaskOutputSchema = z.object({
  task: z.any().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});

function formatCustomFields(
  customFieldData?: Array<{ field: { id: number; name?: string }; value: unknown }>,
): Record<string, unknown> {
  if (!customFieldData) return {};
  const result: Record<string, unknown> = {};
  for (const cf of customFieldData) {
    const name = cf.field.name || `field_${cf.field.id}`;
    result[name] = cf.value;
  }
  return result;
}

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof GetTaskOutputSchema>> {
  const { taskId } = GetTaskInputSchema.parse(args);

  try {
    const task = await planfixRequest<TaskFullResponse>({
      path: `task/${taskId}`,
      method: "GET",
      body: {
        fields:
          "id,name,description,status,importance,dateTime,startDateTime,endDateTime,counterparty,template,project,parent,assignees,members,customFieldData,files,isOverdued,isCloseToDeadline,isNotAcceptedInTime",
      },
    });

    const formatted = {
      id: task.id,
      title: task.name || task.title,
      description: task.description,
      status: task.status?.name,
      priority: task.importance || task.priority,
      createdAt: task.dateTime,
      startDate: task.startDateTime,
      endDate: task.endDateTime,
      isOverdue: task.isOverdued,
      isCloseToDeadline: task.isCloseToDeadline,
      counterparty: task.counterparty
        ? { id: task.counterparty.id, name: task.counterparty.name }
        : undefined,
      template: task.template?.name,
      project: task.project?.name,
      parentTask: task.parent
        ? { id: task.parent.id, title: task.parent.name }
        : undefined,
      assignees: task.assignees?.users?.map((u) => u.name).filter(Boolean),
      members: task.members?.users?.map((u) => u.name).filter(Boolean),
      customFields: formatCustomFields(
        task.customFieldData as Array<{
          field: { id: number; name?: string };
          value: unknown;
        }>,
      ),
      files: task.files?.map((f) => ({
        id: f.id,
        name: f.name,
        size: f.size,
      })),
      url: getTaskUrl(task.id),
    };

    return { task: formatted, url: getTaskUrl(task.id) };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfix_get_task] Error: ${errorMessage}`);
    return { error: errorMessage };
  }
}

export default getToolWithHandler({
  name: "planfix_get_task",
  description:
    "Get full details of a Planfix task: title, description, status, deadlines, counterparty, assignees, custom fields, and attached files list.",
  inputSchema: GetTaskInputSchema,
  outputSchema: GetTaskOutputSchema,
  handler,
});
