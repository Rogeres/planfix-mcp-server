import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";
import { getCredential } from "./keychain.js";

// change cwd to current file directory before load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.chdir(path.join(__dirname, ".."));
dotenv.config({ quiet: true });

// Planfix API configuration
// These start from env vars, but can be enriched from keychain via initConfig()
export let PLANFIX_ACCOUNT = process.env.PLANFIX_ACCOUNT || "";
export let PLANFIX_TOKEN = process.env.PLANFIX_TOKEN || "";
export let PLANFIX_DOMAIN = process.env.PLANFIX_DOMAIN || "planfix.ru";
export let PLANFIX_BASE_URL = `https://${PLANFIX_ACCOUNT}.${PLANFIX_DOMAIN}/rest/`;
export let PLANFIX_HEADERS: Record<string, string> = {
  Authorization: `Bearer ${PLANFIX_TOKEN}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * Initialize config from keychain if env vars are not set.
 * Priority: env var > keychain > encrypted file fallback
 * Call this before starting the server.
 */
export async function initConfig(): Promise<void> {
  if (!PLANFIX_ACCOUNT) {
    const account = await getCredential("PLANFIX_ACCOUNT");
    if (account) PLANFIX_ACCOUNT = account;
  }

  if (!PLANFIX_TOKEN) {
    const token = await getCredential("PLANFIX_TOKEN");
    if (token) PLANFIX_TOKEN = token;
  }

  if (!PLANFIX_DOMAIN || PLANFIX_DOMAIN === "planfix.ru") {
    const domain = await getCredential("PLANFIX_DOMAIN");
    if (domain) PLANFIX_DOMAIN = domain;
  }

  // Rebuild derived values
  PLANFIX_BASE_URL = `https://${PLANFIX_ACCOUNT}.${PLANFIX_DOMAIN}/rest/`;
  PLANFIX_HEADERS = {
    Authorization: `Bearer ${PLANFIX_TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

export const PLANFIX_DRY_RUN = Boolean(process.env.PLANFIX_DRY_RUN);

export const PLANFIX_TASK_TITLE_TEMPLATE =
  process.env.PLANFIX_TASK_TITLE_TEMPLATE || "";

export const PLANFIX_FIELD_IDS = {
  email: Number(process.env.PLANFIX_FIELD_ID_EMAIL || 108),
  phone: Number(process.env.PLANFIX_FIELD_ID_PHONE || 105),
  telegram: process.env.PLANFIX_FIELD_ID_TELEGRAM_CUSTOM
    ? 0
    : Number(process.env.PLANFIX_FIELD_ID_TELEGRAM || 131),
  telegramCustom: Number(process.env.PLANFIX_FIELD_ID_TELEGRAM_CUSTOM),
  client: Number(process.env.PLANFIX_FIELD_ID_CLIENT),
  manager: Number(process.env.PLANFIX_FIELD_ID_MANAGER),
  agency: Number(process.env.PLANFIX_FIELD_ID_AGENCY),
  leadSource: Number(process.env.PLANFIX_FIELD_ID_LEAD_SOURCE),
  pipeline: Number(process.env.PLANFIX_FIELD_ID_PIPELINE),
  serviceMatrix: Number(process.env.PLANFIX_FIELD_ID_SERVICE_MATRIX),
  tags: Number(process.env.PLANFIX_FIELD_ID_TAGS),
  leadId: Number(process.env.PLANFIX_FIELD_ID_LEAD_ID),
};
