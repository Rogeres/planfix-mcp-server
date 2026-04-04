import { z } from "zod";
import {
  getContactUrl,
  getTaskUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { ContactResponse, TaskListItem } from "../types.js";

const SearchInputSchema = z.object({
  query: z.string().describe("Search query: client name, task title, keywords"),
});

const SearchOutputSchema = z.object({
  contacts: z.array(z.any()),
  tasks: z.array(z.any()),
  totalContacts: z.number(),
  totalTasks: z.number(),
  error: z.string().optional(),
});

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof SearchOutputSchema>> {
  const { query } = SearchInputSchema.parse(args);

  try {
    // Search contacts and tasks in parallel
    const [contactsResult, tasksResult] = await Promise.all([
      planfixRequest<{ contacts?: ContactResponse[] }>({
        path: "contact/list",
        body: {
          offset: 0,
          pageSize: 100,
          fields:
            "id,name,midname,lastname,email,phone,description,group",
          filters: [
            {
              type: 4001, // by name
              operator: "equal",
              value: query,
            },
          ],
        },
      }).catch((err) => {
        log(`[planfix_search] Contact search error: ${err.message}`);
        return { contacts: [] as ContactResponse[] };
      }),
      planfixRequest<{ tasks?: TaskListItem[] }>({
        path: "task/list",
        body: {
          offset: 0,
          pageSize: 100,
          fields:
            "id,name,description,status,template,counterparty,startDateTime,endDateTime,assignees,isOverdued",
          filters: [
            {
              type: 8, // by name
              operator: "equal",
              value: query,
            },
          ],
        },
      }).catch((err) => {
        log(`[planfix_search] Task search error: ${err.message}`);
        return { tasks: [] as TaskListItem[] };
      }),
    ]);

    const contacts = (contactsResult.contacts || []).map((c) => ({
      id: c.id,
      name: [c.name, c.lastname].filter(Boolean).join(" "),
      email: c.email,
      url: getContactUrl(c.id),
    }));

    const tasks = (tasksResult.tasks || []).map((t) => ({
      id: t.id,
      title: t.name || t.title,
      status: t.status?.name,
      template: t.template?.name,
      counterparty: t.counterparty?.name,
      endDate: t.endDateTime,
      isOverdue: t.isOverdued,
      assignees: t.assignees?.users?.map((u) => u.name).filter(Boolean),
      url: getTaskUrl(t.id),
    }));

    return {
      contacts,
      tasks,
      totalContacts: contacts.length,
      totalTasks: tasks.length,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfix_search] Error: ${errorMessage}`);
    return {
      contacts: [],
      tasks: [],
      totalContacts: 0,
      totalTasks: 0,
      error: errorMessage,
    };
  }
}

export default getToolWithHandler({
  name: "planfix_search",
  description:
    "Universal search across Planfix: searches both contacts and tasks by name/title simultaneously. Use as the starting point to find anything.",
  inputSchema: SearchInputSchema,
  outputSchema: SearchOutputSchema,
  handler,
});
