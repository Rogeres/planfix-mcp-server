import {
  CallToolResult,
  Tool,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { customFieldsConfig } from "./customFieldsConfig.js";
import { extendSchemaWithCustomFields } from "./lib/extendSchemaWithCustomFields.js";

// Utility function to handle null values by converting them to undefined
const nullFix = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === null ? undefined : val), schema);

export type ToolInput = z.infer<typeof ToolSchema.shape.inputSchema>;
export type ToolOutput = CallToolResult;

// Input and Output Schemas
export const UserDataInputSchemaBase = z.object({
  name: z.string().optional(),
  nameTranslated: z
    .string()
    .optional()
    .describe("Translate name and place here"),
  phone: nullFix(z.string().optional()),
  email: nullFix(z.string().optional()),
  telegram: nullFix(z.string().optional()),
  instagram: nullFix(z.string().optional()),
  company: nullFix(z.string().optional()),
});

export const UserDataInputSchema = extendSchemaWithCustomFields(
  UserDataInputSchemaBase,
  customFieldsConfig.contactFields,
);

export type UsersListType = {
  users: {
    id: string;
    name?: string;
  }[];
  groups?: {
    id: number;
  }[];
  roles?: string[];
};

export type CustomFieldDataType = {
  field: {
    id: number;
  };
  value: string | string[] | number | { id: number } | { id: number }[];
};

export type ToolWithHandler = Tool & {
  handler: <T = unknown>(args?: Record<string, unknown>) => Promise<T>;
};

export interface TaskRequestBody {
  template: {
    id: number;
  };
  status?: {
    id: number;
  };
  name?: string;
  description?: string;
  customFieldData: CustomFieldDataType[];
  project?: {
    id: number;
  };
  assignees?: UsersListType;
}
export interface ContactRequestBody {
  template: {
    id: number;
  };
  name?: string;
  lastname?: string;
  email?: string;
  phones?: Array<{
    type: number;
    number: string;
  }>;
  telegram?: string;
  instagram?: string;
  customFieldData: CustomFieldDataType[];
}

export interface ContactResponse {
  id: number;
  name?: string;
  lastname?: string;
  email?: string;
  phones?: Array<{ number: string; type: number }>;
  telegram?: string;
  customFieldData?: CustomFieldDataType[];
}

export interface TaskResponse {
  id: number;
  project?: { id: number };
  assignees?: { users?: Array<{ id: string }> };
  customFieldData?: CustomFieldDataType[];
  status?: { id: number };
}

// Full task details from GET /task/{id}
export interface TaskFullResponse {
  id: number;
  title?: string;
  name?: string;
  description?: string;
  status?: { id: number; name: string };
  priority?: string;
  importance?: string;
  dateTime?: string;
  startDateTime?: string;
  endDateTime?: string;
  counterparty?: { id: number; name?: string };
  template?: { id: number; name?: string };
  project?: { id: number; name?: string };
  parent?: { id: number; name?: string };
  assignees?: {
    users?: Array<{ id: string; name?: string }>;
    groups?: Array<{ id: number; name?: string }>;
  };
  members?: {
    users?: Array<{ id: string; name?: string }>;
  };
  customFieldData?: CustomFieldDataType[];
  files?: FileAttachment[];
  isOverdued?: boolean;
  isCloseToDeadline?: boolean;
  isNotAcceptedInTime?: boolean;
}

export interface FileAttachment {
  id: number;
  name: string;
  size?: number;
  mimeType?: string;
  version?: number;
}

export interface CommentResponse {
  id: number;
  dateTime?: string;
  owner?: { id: number; name?: string; type?: string };
  body?: string;
  description?: string;
  type?: string;
  files?: FileAttachment[];
  recipients?: Array<{ id: number; name?: string }>;
}

export interface ContactFullResponse {
  id: number;
  name?: string;
  midname?: string;
  lastname?: string;
  email?: string;
  phones?: Array<{ number: string; type: number }>;
  telegram?: string;
  instagram?: string;
  description?: string;
  companies?: Array<{ id: number; name?: string }>;
  group?: { id: number; name?: string };
  customFieldData?: CustomFieldDataType[];
}

export interface TaskListItem {
  id: number;
  name?: string;
  title?: string;
  status?: { id: number; name: string; isActive?: boolean };
  template?: { id: number; name?: string };
  counterparty?: { id: number; name?: string };
  startDateTime?: string;
  endDateTime?: string;
  isOverdued?: boolean;
  assignees?: {
    users?: Array<{ id: string; name?: string }>;
  };
}
