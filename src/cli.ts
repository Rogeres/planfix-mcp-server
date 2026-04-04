#!/usr/bin/env node
import { Command } from "commander";
import {
  setCredential,
  getCredential,
  deleteCredential,
  getStorageBackend,
} from "./keychain.js";
import * as readline from "readline";

const program = new Command();

program
  .name("planfix-mcp-auth")
  .description("Manage Planfix MCP credentials (stored in OS keychain)")
  .version("1.0.0");

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Disable echoing for password input
    if (process.stdin.isTTY) {
      process.stdout.write(prompt);
      const stdin = process.stdin;
      stdin.setRawMode(true);
      stdin.resume();
      stdin.setEncoding("utf-8");

      let input = "";
      const onData = (ch: string) => {
        const c = ch.toString();
        if (c === "\n" || c === "\r" || c === "\u0004") {
          stdin.setRawMode(false);
          stdin.removeListener("data", onData);
          rl.close();
          process.stdout.write("\n");
          resolve(input);
        } else if (c === "\u0003") {
          // Ctrl+C
          process.exit(1);
        } else if (c === "\u007f" || c === "\b") {
          // Backspace
          if (input.length > 0) {
            input = input.slice(0, -1);
          }
        } else {
          input += c;
        }
      };
      stdin.on("data", onData);
    } else {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

function ask(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

program
  .command("login")
  .description("Save Planfix credentials to keychain")
  .action(async () => {
    console.log(`Storage backend: ${getStorageBackend()}\n`);

    const account = await ask("Planfix account (subdomain): ");
    if (!account) {
      console.error("Account is required");
      process.exit(1);
    }

    const token = await askHidden("Planfix API token: ");
    if (!token) {
      console.error("Token is required");
      process.exit(1);
    }

    await setCredential("PLANFIX_ACCOUNT", account);
    await setCredential("PLANFIX_TOKEN", token);

    console.log(`\nCredentials saved to ${getStorageBackend()}`);
    console.log(`Account: ${account}`);
    console.log("Token: ****" + token.slice(-4));
  });

program
  .command("status")
  .description("Check if credentials are configured")
  .action(async () => {
    console.log(`Storage backend: ${getStorageBackend()}\n`);

    const account = await getCredential("PLANFIX_ACCOUNT");
    const token = await getCredential("PLANFIX_TOKEN");

    if (account) {
      console.log(`Account: ${account}`);
    } else {
      console.log("Account: not set");
    }

    if (token) {
      console.log(`Token: ****${token.slice(-4)}`);
    } else {
      console.log("Token: not set");
    }

    const source = process.env.PLANFIX_TOKEN
      ? "environment variable"
      : account
        ? getStorageBackend()
        : "not configured";
    console.log(`\nSource: ${source}`);
  });

program
  .command("logout")
  .description("Remove Planfix credentials from keychain")
  .action(async () => {
    await deleteCredential("PLANFIX_ACCOUNT");
    await deleteCredential("PLANFIX_TOKEN");
    console.log("Credentials removed");
  });

program.parse();
