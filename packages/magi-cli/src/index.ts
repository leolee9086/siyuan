import WebSocket from "ws";
import * as readline from "node:readline";
import { createInterface } from "node:readline";
import { randomBytes } from "node:crypto";

const WS_URL = process.env.MAGI_WS_URL || "ws://127.0.0.1:6806/api/s-forge/magi/v1/channel/cli/ws";
const WORKING_DIR = process.env.MAGI_DIR || process.cwd();
const SCENARIO = process.env.MAGI_SCENARIO || "cli";

function sessionID() {
  return randomBytes(8).toString("hex");
}

const singleMsg = process.argv.includes("--msg") || process.argv.includes("-m");
const msgIndex = Math.max(process.argv.indexOf("--msg"), process.argv.indexOf("-m"));
const messageText = msgIndex >= 0 ? process.argv[msgIndex + 1] : undefined;

let ws: WebSocket;
let pendingCount = 0;

function connect() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "auth", sessionId: sessionID(), workingDir: WORKING_DIR, scenario: SCENARIO }));
    });

    ws.on("message", (raw: Buffer) => {
      try {
        const frame = JSON.parse(raw.toString());
        if (frame.type === "auth_result") {
          if (frame.ok) {
            console.error(`connected (session: ${frame.session})`);
            resolve(void 0);
          } else {
            reject(new Error(`auth failed: ${frame.error}`));
          }
        } else if (frame.type === "message") {
          console.log(frame.text);
          if (singleMsg) {
            pendingCount--;
            if (pendingCount <= 0) {
              setTimeout(() => ws.close(), 500);
            }
          }
        } else if (frame.type === "error") {
          console.error(`[error] ${frame.error}`);
        }
      } catch {
        console.error(raw.toString());
      }
    });

    ws.on("error", (err) => {
      console.error(`connection error: ${err.message}`);
      reject(err);
    });

    ws.on("close", () => {
      process.exit(0);
    });
  });
}

function send(text: string) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "message", text }));
    pendingCount++;
  }
}

async function main(){
  try {
    await connect();
  } catch {
    process.exit(1);
  }

  if (singleMsg && messageText) {
    send(messageText);
    return;
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr, prompt: "> " });
  rl.prompt();

  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed === "/exit" || trimmed === "/quit") {
      ws.close();
      return;
    }
    if (trimmed === "/help") {
      console.error("Commands: /exit, /quit, /help — everything else is sent to MAGI");
      rl.prompt();
      return;
    }
    send(trimmed);
  });

  rl.on("close", () => {
    ws.close();
  });
}

main();
