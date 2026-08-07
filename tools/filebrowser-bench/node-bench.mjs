import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const FNV_OFFSET = 14695981039346656037n;
const FNV_PRIME = 1099511628211n;
const MASK_64 = (1n << 64n) - 1n;

function parseArguments(argv) {
    const result = {};
    for (let index = 0; index < argv.length; index += 2) {
        result[argv[index].replace(/^--/, "")] = argv[index + 1];
    }
    return result;
}

class Accumulator {
    constructor(root, withDigest) {
        this.root = path.resolve(root);
        this.withDigest = withDigest;
        this.entries = 0;
        this.files = 0;
        this.directories = 0;
        this.digestXor = 0n;
        this.digestSum = 0n;
    }

    add(entryPath, isDirectory, absolute = false) {
        const relative = absolute ? path.relative(this.root, entryPath) : entryPath;
        if (!relative || relative === ".") {
            return;
        }
        const normalized = relative.replaceAll("\\", "/");
        this.entries++;
        if (isDirectory) {
            this.directories++;
        } else {
            this.files++;
        }
        if (!this.withDigest) {
            return;
        }
        let hash = FNV_OFFSET;
        for (const value of Buffer.from(normalized, "utf8")) {
            hash ^= BigInt(value);
            hash = (hash * FNV_PRIME) & MASK_64;
        }
        this.digestXor ^= hash;
        this.digestSum = (this.digestSum + hash) & MASK_64;
    }

    snapshot(errorsKnown = false) {
        return {
            entries: this.entries,
            files: this.files,
            directories: this.directories,
            errors: 0,
            errorsKnown,
            digest: this.withDigest
                ? `${this.digestXor.toString(16).padStart(16, "0")}:${this.digestSum.toString(16).padStart(16, "0")}`
                : "",
        };
    }
}

async function loadImplementations(sacRoot) {
    const require = createRequire(path.join(sacRoot, "package.json"));
    globalThis.require = require;
    const modifiedURL = pathToFileURL(path.join(sacRoot, "source/server/processors/fs/fdirModified/index.js"));
    const modified = await import(modifiedURL.href);
    const stock = require("fdir");
    const fastGlob = require("fast-glob");
    const versions = {
        "sac-fdir-modified": "94c8534a/fdirModified",
        "fdir-stock": require("fdir/package.json").version,
        "fast-glob-promise": require("fast-glob/package.json").version,
        "fast-glob-stream": require("fast-glob/package.json").version,
    };
    return { modified: modified.fdir, stock: stock.fdir, fastGlob, versions };
}

async function runFdir(Fdir, root, withDigest) {
    const accumulator = new Accumulator(root, withDigest);
    const api = new Fdir()
        .withFullPaths()
        .withDirs()
        .filter((entryPath, isDirectory) => {
            accumulator.add(entryPath, isDirectory, true);
            return true;
        })
        .crawl(root);
    await api.withPromise();
    return accumulator.snapshot(false);
}

function fastGlobOptions(root) {
    return {
        cwd: root,
        absolute: false,
        dot: true,
        onlyFiles: false,
        followSymbolicLinks: false,
        suppressErrors: true,
        objectMode: true,
        unique: true,
    };
}

async function runFastGlobPromise(fastGlob, root, withDigest) {
    const accumulator = new Accumulator(root, withDigest);
    const entries = await fastGlob("**/*", fastGlobOptions(root));
    for (const entry of entries) {
        accumulator.add(entry.path, entry.dirent.isDirectory());
    }
    return accumulator.snapshot(false);
}

async function runFastGlobStream(fastGlob, root, withDigest) {
    const accumulator = new Accumulator(root, withDigest);
    for await (const entry of fastGlob.stream("**/*", fastGlobOptions(root))) {
        accumulator.add(entry.path, entry.dirent.isDirectory());
    }
    return accumulator.snapshot(false);
}

async function measure(run, withDigest) {
    globalThis.gc?.();
    const before = process.memoryUsage().heapUsed;
    const started = performance.now();
    const snapshot = await run(withDigest);
    const elapsedNanoseconds = Math.round((performance.now() - started) * 1_000_000);
    const after = process.memoryUsage().heapUsed;
    return {
        elapsedNanoseconds,
        allocatedBytes: 0,
        allocationKnown: false,
        heapDeltaBytes: after - before,
        snapshot,
    };
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const implementation = options.implementation;
    const root = path.resolve(options.root);
    const warmups = Number.parseInt(options.warmups, 10);
    const iterations = Number.parseInt(options.iterations, 10);
    const loaded = await loadImplementations(path.resolve(options["sac-root"]));
    const runners = {
        "sac-fdir-modified": digest => runFdir(loaded.modified, root, digest),
        "fdir-stock": digest => runFdir(loaded.stock, root, digest),
        "fast-glob-promise": digest => runFastGlobPromise(loaded.fastGlob, root, digest),
        "fast-glob-stream": digest => runFastGlobStream(loaded.fastGlob, root, digest),
    };
    const run = runners[implementation];
    if (!run) {
        throw new Error(`unknown implementation: ${implementation}`);
    }
    const validation = await measure(run, true);
    for (let index = 0; index < warmups; index++) {
        await run(false);
    }
    const samples = [];
    for (let index = 0; index < iterations; index++) {
        samples.push(await measure(run, false));
    }
    process.stdout.write(JSON.stringify({
        name: implementation,
        version: loaded.versions[implementation],
        validation,
        samples,
    }));
}

await main();
