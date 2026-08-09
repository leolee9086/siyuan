import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(appRoot, "..", "..");
const defaultSource = "D:\\dev\\d5a-viewer";
const defaultTarget = path.join(repositoryRoot, "packages", "d5a-viewer");

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (argument === "--hash") {
        args.set("hash", true);
        continue;
    }
    if (argument === "--strict") {
        args.set("strict", true);
        continue;
    }
    if (argument.startsWith("--source=")) {
        args.set("source", argument.slice("--source=".length));
        continue;
    }
    if (argument.startsWith("--target=")) {
        args.set("target", argument.slice("--target=".length));
        continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
}

const sourceRoot = path.resolve(args.get("source") || defaultSource);
const targetRoot = path.resolve(args.get("target") || defaultTarget);

function displayPath(relativePath) {
    return relativePath || ".";
}

async function inventory(root) {
    const entries = new Map();

    async function visit(relativePath) {
        const absolutePath = path.join(root, relativePath);
        const stat = await fs.lstat(absolutePath);
        if (stat.isSymbolicLink()) {
            entries.set(relativePath, {
                kind: "symlink",
                target: await fs.readlink(absolutePath),
            });
            return;
        }
        if (stat.isDirectory()) {
            if (relativePath === ".git" || relativePath.startsWith(`.git${path.sep}`)) {
                return;
            }
            entries.set(relativePath, {kind: "directory"});
            const children = await fs.readdir(absolutePath);
            children.sort((left, right) => left.localeCompare(right));
            for (const child of children) {
                await visit(path.join(relativePath, child));
            }
            return;
        }
        if (stat.isFile()) {
            entries.set(relativePath, {
                kind: "file",
                size: stat.size,
                mtimeMs: stat.mtimeMs,
            });
            return;
        }
        entries.set(relativePath, {kind: "other"});
    }

    await visit("");
    entries.delete("");
    return entries;
}

async function hashFile(filePath) {
    const hash = crypto.createHash("sha256");
    const handle = await fs.open(filePath, "r");
    try {
        for await (const chunk of handle.createReadStream()) {
            hash.update(chunk);
        }
    } finally {
        await handle.close();
    }
    return hash.digest("hex");
}

const [source, target] = await Promise.all([inventory(sourceRoot), inventory(targetRoot)]);
const missing = [];
const typeMismatches = [];
const hashMismatches = [];

for (const [relativePath, sourceEntry] of source) {
    const targetEntry = target.get(relativePath);
    if (!targetEntry) {
        missing.push(relativePath);
        continue;
    }
    if (sourceEntry.kind !== targetEntry.kind) {
        typeMismatches.push(`${displayPath(relativePath)} (${sourceEntry.kind} -> ${targetEntry.kind})`);
        continue;
    }
    if (args.get("hash") && sourceEntry.kind === "file") {
        const [sourceHash, targetHash] = await Promise.all([
            hashFile(path.join(sourceRoot, relativePath)),
            hashFile(path.join(targetRoot, relativePath)),
        ]);
        if (sourceHash !== targetHash) {
            hashMismatches.push(displayPath(relativePath));
        }
    }
}

const extras = [...target.keys()].filter((relativePath) => !source.has(relativePath));
const errors = [...missing, ...typeMismatches];
if (args.get("strict")) {
    errors.push(...extras.map((relativePath) => `extra: ${displayPath(relativePath)}`));
}

console.log(`source=${sourceRoot}`);
console.log(`target=${targetRoot}`);
console.log(`sourceEntries=${source.size}`);
console.log(`targetEntries=${target.size}`);
console.log(`missing=${missing.length}`);
console.log(`typeMismatches=${typeMismatches.length}`);
console.log(`extras=${extras.length}`);
if (args.get("hash")) {
    console.log(`hashMismatches=${hashMismatches.length}`);
}

for (const [label, values] of [
    ["missing", missing],
    ["typeMismatches", typeMismatches],
    ["extras", extras],
    ["hashMismatches", hashMismatches],
]) {
    if (values.length === 0) {
        continue;
    }
    console.log(`${label}Paths:`);
    for (const value of values.slice(0, 200)) {
        console.log(`  ${displayPath(value)}`);
    }
    if (values.length > 200) {
        console.log(`  ... ${values.length - 200} more`);
    }
}

if (errors.length > 0) {
    process.exitCode = 1;
}
