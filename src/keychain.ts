import { execFile } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const execFileAsync = promisify(execFile);

const SERVICE = "planfix-mcp";

// ============================================================
// Credential storage with priority:
//   1. env var PLANFIX_TOKEN
//   2. OS keychain (macOS Keychain / Linux libsecret)
//   3. Encrypted file (~/.config/planfix-mcp/.credentials)
// ============================================================

// --- macOS: security CLI ---

async function macSetPassword(
  account: string,
  password: string,
): Promise<void> {
  try {
    await execFileAsync("security", [
      "delete-generic-password",
      "-s",
      SERVICE,
      "-a",
      account,
    ]);
  } catch {
    // Not found — fine
  }

  await execFileAsync("security", [
    "add-generic-password",
    "-s",
    SERVICE,
    "-a",
    account,
    "-w",
    password,
    "-U",
  ]);
}

async function macGetPassword(account: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      SERVICE,
      "-a",
      account,
      "-w",
    ]);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function macDeletePassword(account: string): Promise<void> {
  try {
    await execFileAsync("security", [
      "delete-generic-password",
      "-s",
      SERVICE,
      "-a",
      account,
    ]);
  } catch {
    // Not found — fine
  }
}

// --- Linux: secret-tool (libsecret) ---

async function linuxSetPassword(
  account: string,
  password: string,
): Promise<void> {
  const child = execFileAsync("secret-tool", [
    "store",
    "--label",
    `${SERVICE}: ${account}`,
    "service",
    SERVICE,
    "account",
    account,
  ]);
  child.child.stdin?.write(password);
  child.child.stdin?.end();
  await child;
}

async function linuxGetPassword(account: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("secret-tool", [
      "lookup",
      "service",
      SERVICE,
      "account",
      account,
    ]);
    return stdout || null;
  } catch {
    return null;
  }
}

async function linuxDeletePassword(account: string): Promise<void> {
  try {
    await execFileAsync("secret-tool", [
      "clear",
      "service",
      SERVICE,
      "account",
      account,
    ]);
  } catch {
    // Not found — fine
  }
}

// --- Encrypted file fallback ---

function getCredentialsPath(): string {
  const dir = path.join(os.homedir(), ".config", "planfix-mcp");
  return path.join(dir, ".credentials");
}

function deriveKey(): Buffer {
  const material = [os.hostname(), os.homedir(), SERVICE].join("|");
  return crypto.createHash("sha256").update(material).digest();
}

function readCredentialsFile(): Record<
  string,
  { iv: string; tag: string; data: string }
> {
  const filePath = getCredentialsPath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return {};
  }
}

function writeCredentialsFile(
  creds: Record<string, { iv: string; tag: string; data: string }>,
): void {
  const filePath = getCredentialsPath();
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function fileSetPassword(account: string, password: string): void {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const creds = readCredentialsFile();
  creds[account] = {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64"),
  };
  writeCredentialsFile(creds);
}

function fileGetPassword(account: string): string | null {
  const creds = readCredentialsFile();
  const entry = creds[account];
  if (!entry) return null;

  try {
    const key = deriveKey();
    const iv = Buffer.from(entry.iv, "base64");
    const tag = Buffer.from(entry.tag, "base64");
    const data = Buffer.from(entry.data, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final("utf-8");
  } catch {
    return null;
  }
}

function fileDeletePassword(account: string): void {
  const creds = readCredentialsFile();
  delete creds[account];
  writeCredentialsFile(creds);
}

// --- OS keychain availability ---

async function isKeychainAvailable(): Promise<boolean> {
  if (process.platform === "darwin") {
    try {
      await execFileAsync("security", ["help"]);
      return true;
    } catch {
      return false;
    }
  }

  if (process.platform === "linux") {
    try {
      await execFileAsync("which", ["secret-tool"]);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

let _keychainAvailable: boolean | null = null;

async function useKeychain(): Promise<boolean> {
  if (_keychainAvailable === null) {
    _keychainAvailable = await isKeychainAvailable();
  }
  return _keychainAvailable;
}

// --- Public API ---

export async function setCredential(
  key: string,
  value: string,
): Promise<void> {
  if (await useKeychain()) {
    try {
      if (process.platform === "darwin") {
        return await macSetPassword(key, value);
      }
      if (process.platform === "linux") {
        return await linuxSetPassword(key, value);
      }
    } catch {
      // Fall through to file
    }
  }
  fileSetPassword(key, value);
}

export async function getCredential(key: string): Promise<string | null> {
  // 1. Check environment variable (PLANFIX_TOKEN, PLANFIX_ACCOUNT)
  const envValue = process.env[key];
  if (envValue) return envValue;

  // 2. Try OS keychain
  if (await useKeychain()) {
    try {
      let password: string | null = null;
      if (process.platform === "darwin") {
        password = await macGetPassword(key);
      } else if (process.platform === "linux") {
        password = await linuxGetPassword(key);
      }
      if (password) return password;
    } catch {
      // Fall through to file
    }
  }

  // 3. Fall back to encrypted file
  return fileGetPassword(key);
}

export async function deleteCredential(key: string): Promise<void> {
  if (await useKeychain()) {
    try {
      if (process.platform === "darwin") {
        await macDeletePassword(key);
      } else if (process.platform === "linux") {
        await linuxDeletePassword(key);
      }
    } catch {
      // Ignore
    }
  }
  fileDeletePassword(key);
}

export function getStorageBackend(): string {
  if (process.platform === "darwin") return "macOS Keychain";
  if (process.platform === "linux") return "libsecret (secret-tool)";
  return "encrypted file";
}
