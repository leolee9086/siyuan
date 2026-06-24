#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function runGit(args) {
    const result = spawnSync("git", args, {
        cwd: process.cwd(),
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 512,
        stdio: ["ignore", "pipe", "pipe"],
    });

    if (result.error) {
        throw result.error;
    }

    if (result.status !== 0) {
        throw new Error(result.stderr || `git ${args.join(" ")} failed with exit code ${result.status}`);
    }

    return result.stdout;
}

function parsePorcelainStatus(output) {
    const entries = output.split("\0").filter(Boolean);
    const paths = [];

    for (const entry of entries) {
        if (entry.slice(0, 2) === "DU") {
            paths.push(entry.slice(3));
        }
    }

    return paths;
}

function redirectTheirsPath(filePath) {
    const remotePath = `${filePath}.remote`;

    runGit(["checkout", "--theirs", "--", filePath]);
    runGit(["add", "--", filePath]);
    runGit(["mv", "--force", filePath, remotePath]);

    return remotePath;
}

function main() {
    const status = runGit(["status", "--porcelain=v1", "-z"]);
    const paths = parsePorcelainStatus(status);

    if (paths.length === 0) {
        console.log("未发现 deleted by us / modified by them 的冲突文件。");
        return;
    }

    for (const filePath of paths) {
        const remotePath = redirectTheirsPath(filePath);
        console.log(`${filePath} => ${remotePath}`);
    }
}

main();
