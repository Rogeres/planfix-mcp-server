import { z } from "zod";
import {
  getContactUrl,
  getToolWithHandler,
  log,
  planfixRequest,
} from "../helpers.js";
import type { ContactFullResponse } from "../types.js";

const GetContactInputSchema = z.object({
  contactId: z.number().describe("Planfix contact ID"),
});

const GetContactOutputSchema = z.object({
  contact: z.any().optional(),
  url: z.string().optional(),
  error: z.string().optional(),
});

async function handler(
  args?: Record<string, unknown>,
): Promise<z.infer<typeof GetContactOutputSchema>> {
  const { contactId } = GetContactInputSchema.parse(args);

  try {
    const contact = await planfixRequest<ContactFullResponse>({
      path: `contact/${contactId}`,
      method: "GET",
      body: {
        fields:
          "id,name,midname,lastname,email,phones,telegram,instagram,description,companies,group,customFieldData",
      },
    });

    const customFields: Record<string, unknown> = {};
    if (contact.customFieldData) {
      for (const cf of contact.customFieldData) {
        const name = (cf.field as { id: number; name?: string }).name || `field_${cf.field.id}`;
        customFields[name] = cf.value;
      }
    }

    const formatted = {
      id: contact.id,
      name: [contact.name, contact.midname, contact.lastname]
        .filter(Boolean)
        .join(" "),
      firstName: contact.name,
      middleName: contact.midname,
      lastName: contact.lastname,
      email: contact.email,
      phones: contact.phones?.map((p) => p.number),
      telegram: contact.telegram,
      instagram: contact.instagram,
      description: contact.description,
      companies: contact.companies?.map((c) => ({
        id: c.id,
        name: c.name,
      })),
      group: contact.group?.name,
      customFields:
        Object.keys(customFields).length > 0 ? customFields : undefined,
      url: getContactUrl(contact.id),
    };

    return { contact: formatted, url: getContactUrl(contact.id) };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    log(`[planfix_get_contact] Error: ${errorMessage}`);
    return { error: errorMessage };
  }
}

export default getToolWithHandler({
  name: "planfix_get_contact",
  description:
    "Get full details of a Planfix contact/counterparty: name, email, phones, telegram, companies, custom fields.",
  inputSchema: GetContactInputSchema,
  outputSchema: GetContactOutputSchema,
  handler,
});
