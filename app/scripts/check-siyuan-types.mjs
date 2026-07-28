import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(readFileSync(join(appRoot, file), "utf8"));
const packageJson = readJson("package.json");
const declaredVersion = packageJson.devDependencies?.siyuan;
if (declaredVersion !== "latest") {
    throw new Error("siyuan must use the official latest dist-tag, found " + String(declaredVersion));
}

const latestVersion = JSON.parse(execFileSync("pnpm", ["view", "siyuan", "version", "--json"], {
    cwd: appRoot,
    encoding: "utf8",
    shell: true,
}));
const installedVersion = readJson("node_modules/siyuan/package.json").version;
if (installedVersion !== latestVersion) {
    throw new Error("installed siyuan " + installedVersion + " is stale; run pnpm update --latest siyuan (latest " + latestVersion + ")");
}

const lockfile = readFileSync(join(appRoot, "pnpm-lock.yaml"), "utf8");
const importerPattern = /\n      siyuan:\r?\n        specifier: latest\r?\n        version: ([^\s\r\n]+)/;
const importerMatch = lockfile.match(importerPattern);
if (!importerMatch || importerMatch[1] !== latestVersion) {
    throw new Error("pnpm-lock.yaml does not pin siyuan latest " + latestVersion + "; run pnpm update --latest siyuan");
}
if (!lockfile.includes("  siyuan@" + latestVersion + ":")) {
    throw new Error("pnpm-lock.yaml has no siyuan@" + latestVersion + " package entry");
}

console.log("siyuan types are current: " + latestVersion);
