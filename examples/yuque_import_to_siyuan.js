#!/usr/bin/env node
"use strict";

/*
Yuque export notes used by this script:
1) Markdown exports are commonly delivered as a ZIP package with .md files and assets.
2) Some exported markdown may still contain remote asset URLs.
This script imports through SiYuan kernel APIs and can optionally localize net assets.
*/

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const process = require("node:process");
const { URL } = require("node:url");

function printUsage() {
  console.log(`
Usage:
  node examples/yuque_import_to_siyuan.js --source <path> [options]

Required:
  --source <path>                Yuque export ZIP, markdown folder, or markdown file

Options:
  --api <url>                    SiYuan API base URL (default: http://127.0.0.1:6806)
  --token <token>                SiYuan API token (or env SIYUAN_API_TOKEN)
  --notebook <idOrName>          Target notebook ID or notebook name
  --to <path>                    Import target doc path in notebook (default: /)
  --mode <auto|zip|std>          Import mode (default: auto)
  --create-notebook <bool>       Create notebook when name does not exist (default: true)
  --download-net-assets <bool>   Run /api/format/netAssets2LocalAssets on imported docs (default: true)
  --help                         Show help

Examples:
  node examples/yuque_import_to_siyuan.js --source "D:\\\\exports\\\\yuque-book.zip" --token "<token>" --notebook "Yuque Import"
  node examples/yuque_import_to_siyuan.js --source "./yuque-export-folder" --notebook "20220126215949-r1wvoch" --download-net-assets false
`.trim());
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    if (key === "help" || key === "h") {
      args.help = "true";
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function parseBool(raw, defaultValue) {
  if (raw === undefined) {
    return defaultValue;
  }
  const value = String(raw).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(value)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(value)) {
    return false;
  }
  throw new Error(`invalid boolean value: ${raw}`);
}

function isNotebookID(value) {
  return /^[0-9]{14}-[a-z0-9]{7}$/.test(String(value));
}

function sqlQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function toURL(apiBase, apiPath) {
  return new URL(apiPath, apiBase.endsWith("/") ? apiBase : `${apiBase}/`);
}

function collectJSONResponse(res, resolve, reject, apiPath) {
  const chunks = [];
  res.on("data", (chunk) => chunks.push(chunk));
  res.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    let parsed;
    try {
      parsed = body ? JSON.parse(body) : {};
    } catch (err) {
      reject(new Error(`${apiPath} returned non-JSON response (status ${res.statusCode}): ${body.slice(0, 300)}`));
      return;
    }
    resolve(parsed);
  });
}

function postJSON(apiBase, token, apiPath, payload) {
  const url = toURL(apiBase, apiPath);
  const mod = url.protocol === "https:" ? https : http;
  const body = Buffer.from(JSON.stringify(payload || {}), "utf8");

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Length": String(body.length),
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
      },
      (res) => collectJSONResponse(res, resolve, reject, apiPath),
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function postMultipartFile(apiBase, token, apiPath, fields, fileFieldName, filePath) {
  const url = toURL(apiBase, apiPath);
  const mod = url.protocol === "https:" ? https : http;
  const boundary = `----siyuan-yuque-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const fileName = path.basename(filePath);

  return new Promise((resolve, reject) => {
    let settled = false;
    const doneReject = (err) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(err);
    };
    const doneResolve = (data) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(data);
    };

    const req = mod.request(
      {
        method: "POST",
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          ...(token ? { Authorization: `Token ${token}` } : {}),
        },
      },
      (res) => collectJSONResponse(res, doneResolve, doneReject, apiPath),
    );
    req.on("error", doneReject);

    try {
      for (const [name, value] of Object.entries(fields)) {
        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="${name}"\r\n\r\n`);
        req.write(String(value));
        req.write("\r\n");
      }
      req.write(`--${boundary}\r\n`);
      req.write(`Content-Disposition: form-data; name="${fileFieldName}"; filename="${fileName}"\r\n`);
      req.write("Content-Type: application/zip\r\n\r\n");
    } catch (err) {
      req.destroy();
      doneReject(err);
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on("error", (err) => {
      req.destroy();
      doneReject(err);
    });
    stream.on("end", () => {
      req.end(`\r\n--${boundary}--\r\n`);
    });
    stream.pipe(req, { end: false });
  });
}

function assertSiyuanSuccess(resp, apiPath) {
  if (!resp || typeof resp !== "object" || !Object.prototype.hasOwnProperty.call(resp, "code")) {
    throw new Error(`${apiPath} returned invalid response`);
  }
  if (resp.code !== 0) {
    throw new Error(`${apiPath} failed: code=${resp.code}, msg=${resp.msg || ""}`);
  }
  return resp.data;
}

function deriveNotebookName(sourcePath) {
  const base = path.basename(sourcePath, path.extname(sourcePath)).trim();
  if (!base) {
    return "Yuque Import";
  }
  if (base.length > 128) {
    return base.slice(0, 128);
  }
  return base;
}

async function listDocIDs(apiBase, token, notebookId) {
  const stmt = [
    "SELECT id",
    "FROM blocks",
    `WHERE box = ${sqlQuote(notebookId)}`,
    "  AND type = 'd'",
    "  AND id = root_id",
  ].join("\n");
  const data = assertSiyuanSuccess(await postJSON(apiBase, token, "/api/query/sql", { stmt }), "/api/query/sql");
  const ids = new Set();
  if (!Array.isArray(data)) {
    return ids;
  }
  for (const row of data) {
    if (row && typeof row.id === "string") {
      ids.add(row.id);
    }
  }
  return ids;
}

async function resolveNotebook(apiBase, token, requested, createNotebook) {
  const data = assertSiyuanSuccess(await postJSON(apiBase, token, "/api/notebook/lsNotebooks", {}), "/api/notebook/lsNotebooks");
  const notebooks = Array.isArray(data.notebooks) ? data.notebooks : [];

  if (requested) {
    const byID = notebooks.find((n) => n.id === requested);
    if (byID) {
      return { id: byID.id, name: byID.name, created: false };
    }
    const byName = notebooks.find((n) => n.name === requested);
    if (byName) {
      return { id: byName.id, name: byName.name, created: false };
    }
    if (isNotebookID(requested)) {
      throw new Error(`notebook ID not found: ${requested}`);
    }
    if (!createNotebook) {
      throw new Error(`notebook name not found and creation disabled: ${requested}`);
    }
    const createdData = assertSiyuanSuccess(
      await postJSON(apiBase, token, "/api/notebook/createNotebook", { name: requested }),
      "/api/notebook/createNotebook",
    );
    const createdNotebook = createdData && createdData.notebook ? createdData.notebook : null;
    if (!createdNotebook || !createdNotebook.id) {
      throw new Error("create notebook returned invalid data");
    }
    return { id: createdNotebook.id, name: createdNotebook.name, created: true };
  }

  if (notebooks.length > 0) {
    const openNotebook = notebooks.find((n) => n.closed === false);
    const target = openNotebook || notebooks[0];
    return { id: target.id, name: target.name, created: false };
  }

  if (!createNotebook) {
    throw new Error("no notebook available and creation disabled");
  }
  const fallbackName = "Yuque Import";
  const createdData = assertSiyuanSuccess(
    await postJSON(apiBase, token, "/api/notebook/createNotebook", { name: fallbackName }),
    "/api/notebook/createNotebook",
  );
  const createdNotebook = createdData && createdData.notebook ? createdData.notebook : null;
  if (!createdNotebook || !createdNotebook.id) {
    throw new Error("create notebook returned invalid data");
  }
  return { id: createdNotebook.id, name: createdNotebook.name, created: true };
}

function detectImportMode(sourcePath, modeRaw) {
  const mode = (modeRaw || "auto").toLowerCase();
  if (!["auto", "zip", "std"].includes(mode)) {
    throw new Error(`unsupported mode: ${mode}`);
  }
  if (mode === "zip") {
    return "zip";
  }
  if (mode === "std") {
    return "std";
  }
  const stat = fs.statSync(sourcePath);
  if (stat.isFile() && path.extname(sourcePath).toLowerCase() === ".zip") {
    return "zip";
  }
  return "std";
}

async function importSource(apiBase, token, notebookId, toPath, sourcePath, mode) {
  if (mode === "zip") {
    if (!fs.statSync(sourcePath).isFile()) {
      throw new Error("zip mode requires --source to be a zip file");
    }
    const ext = path.extname(sourcePath).toLowerCase();
    if (ext !== ".zip") {
      throw new Error("zip mode requires a .zip source file");
    }
    assertSiyuanSuccess(
      await postMultipartFile(
        apiBase,
        token,
        "/api/import/importZipMd",
        {
          notebook: notebookId,
          toPath,
        },
        "file",
        sourcePath,
      ),
      "/api/import/importZipMd",
    );
    return;
  }

  assertSiyuanSuccess(
    await postJSON(apiBase, token, "/api/import/importStdMd", {
      notebook: notebookId,
      localPath: sourcePath,
      toPath,
    }),
    "/api/import/importStdMd",
  );
}

async function localizeNetAssets(apiBase, token, docIDs) {
  const failed = [];
  let done = 0;
  for (const id of docIDs) {
    done += 1;
    process.stdout.write(`  [${done}/${docIDs.length}] localizing doc ${id}\n`);
    try {
      assertSiyuanSuccess(
        await postJSON(apiBase, token, "/api/format/netAssets2LocalAssets", { id }),
        "/api/format/netAssets2LocalAssets",
      );
    } catch (err) {
      failed.push({ id, err: err.message });
    }
  }
  return failed;
}

function setDiff(afterSet, beforeSet) {
  const list = [];
  for (const id of afterSet) {
    if (!beforeSet.has(id)) {
      list.push(id);
    }
  }
  return list;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === "true") {
    printUsage();
    return;
  }

  const sourceArg = args.source;
  if (!sourceArg) {
    printUsage();
    throw new Error("--source is required");
  }

  const sourcePath = path.resolve(sourceArg);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`source does not exist: ${sourcePath}`);
  }

  const apiBase = args.api || process.env.SIYUAN_API_BASE || "http://127.0.0.1:6806";
  const token = args.token || process.env.SIYUAN_API_TOKEN || "";
  const toPath = args.to || "/";
  const createNotebook = parseBool(args["create-notebook"], true);
  const downloadNetAssets = parseBool(args["download-net-assets"], true);
  const notebookInput = args.notebook || deriveNotebookName(sourcePath);
  const mode = detectImportMode(sourcePath, args.mode);

  console.log(`[1/5] Resolve notebook: ${notebookInput}`);
  const notebook = await resolveNotebook(apiBase, token, notebookInput, createNotebook);
  console.log(`      notebook=${notebook.name} (${notebook.id})${notebook.created ? " [created]" : ""}`);

  let before = new Set();
  let canDiffDocs = downloadNetAssets;
  if (downloadNetAssets) {
    console.log("[2/5] Snapshot docs before import");
    try {
      before = await listDocIDs(apiBase, token, notebook.id);
      console.log(`      docs before=${before.size}`);
    } catch (err) {
      canDiffDocs = false;
      console.log(`      skip doc diff: ${err.message}`);
    }
  } else {
    console.log("[2/5] Skip doc snapshot (--download-net-assets false)");
  }

  console.log(`[3/5] Import source with mode=${mode}`);
  await importSource(apiBase, token, notebook.id, toPath, sourcePath, mode);
  console.log("      import done");

  let importedDocIDs = [];
  if (canDiffDocs) {
    console.log("[4/5] Snapshot docs after import");
    const after = await listDocIDs(apiBase, token, notebook.id);
    importedDocIDs = setDiff(after, before);
    console.log(`      docs after=${after.size}, imported=${importedDocIDs.length}`);
  } else {
    console.log("[4/5] Skip doc diff");
  }

  let netAssetFailures = [];
  if (downloadNetAssets && importedDocIDs.length > 0) {
    console.log("[5/5] Localize network assets");
    netAssetFailures = await localizeNetAssets(apiBase, token, importedDocIDs);
    console.log(`      localized=${importedDocIDs.length - netAssetFailures.length}, failed=${netAssetFailures.length}`);
  } else if (downloadNetAssets) {
    console.log("[5/5] Skip net asset localization (no imported docs detected)");
  } else {
    console.log("[5/5] Skip net asset localization");
  }

  console.log("");
  console.log("Import completed.");
  console.log(`  source: ${sourcePath}`);
  console.log(`  notebook: ${notebook.name} (${notebook.id})`);
  console.log(`  target path: ${toPath}`);
  console.log(`  import mode: ${mode}`);
  if (downloadNetAssets) {
    console.log(`  imported docs detected: ${importedDocIDs.length}`);
    console.log(`  net assets localization failures: ${netAssetFailures.length}`);
    if (netAssetFailures.length > 0) {
      for (const item of netAssetFailures) {
        console.log(`    - ${item.id}: ${item.err}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
