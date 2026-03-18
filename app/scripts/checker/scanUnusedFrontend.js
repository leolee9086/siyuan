#!/usr/bin/env node

/**
 * Scan frontend unused code (files / exports / dependencies) with Knip.
 *
 * Usage:
 *   node ./scripts/checker/scanUnusedFrontend.js
 *   node ./scripts/checker/scanUnusedFrontend.js --strict
 *   node ./scripts/checker/scanUnusedFrontend.js --strict --production
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "../..");
const TARGETS_PATH = path.join(ROOT_DIR, "build.targets.json");
const OUTPUT_DIR = path.join(ROOT_DIR, "0_lints");

const GENERATED_CONFIG_PATH = path.join(OUTPUT_DIR, "unused-frontend.knip.config.json");
const RAW_REPORT_PATH = path.join(OUTPUT_DIR, "unused-frontend.knip.raw.json");
const REPORT_PATH = path.join(OUTPUT_DIR, "unused-frontend.report.json");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "unused-frontend.summary.txt");

const STRICT_MODE = process.argv.includes("--strict");
const PRODUCTION_MODE = process.argv.includes("--production");

function log(message) {
    console.log(`[scan:unused:frontend] ${message}`);
}

function toPosix(filePath) {
    return filePath.replace(/\\/g, "/");
}

function normalizeEntry(entryPath) {
    return toPosix(entryPath).replace(/^\.\//, "");
}

function ensureOutputDir() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function readBuildTargets() {
    try {
        const raw = fs.readFileSync(TARGETS_PATH, "utf8");
        return JSON.parse(raw);
    } catch (error) {
        throw new Error(`Failed to read build targets: ${error.message}`);
    }
}

function collectEntryFiles(targets) {
    const entrySet = new Set();
    for (const target of Object.values(targets)) {
        const entries = target && typeof target === "object" ? target.entry : undefined;
        if (!entries || typeof entries !== "object") continue;
        for (const value of Object.values(entries)) {
            if (typeof value !== "string" || value.trim() === "") continue;
            entrySet.add(normalizeEntry(value.trim()));
        }
    }

    const entryFiles = Array.from(entrySet).sort();
    if (entryFiles.length === 0) {
        throw new Error("No frontend entry files found in build.targets.json");
    }
    return entryFiles;
}

function createKnipConfig(entryFiles) {
    return {
        entry: entryFiles,
        project: [
            "src/**/*.{ts,tsx,js,jsx,vue,scss,css}",
        ],
        ignore: [
            "src/**/*.d.ts",
            "src/types/**",
            "src/asset/pdf/**",
        ],
        ignoreDependencies: [
            "-",
        ],
    };
}

function runKnip(configPath) {
    const command = "pnpm";
    const relativeConfigPath = toPosix(path.relative(ROOT_DIR, configPath));
    const args = [
        "dlx",
        "knip",
        "--config",
        relativeConfigPath,
        "--tsConfig",
        "tsconfig.json",
        "--include",
        "files,dependencies,exports",
        "--reporter",
        "json",
        "--no-progress",
    ];

    if (!STRICT_MODE) {
        args.push("--no-exit-code");
    }
    if (PRODUCTION_MODE) {
        args.push("--production");
    }

    return spawnSync(command, args, {
        cwd: ROOT_DIR,
        encoding: "utf8",
        shell: true,
    });
}

function extractJson(stdout) {
    const text = (stdout || "").trim();
    if (!text) {
        throw new Error("Knip returned empty output");
    }

    const startIndex = text.indexOf("{");
    const endIndex = text.lastIndexOf("}");
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
        throw new Error(`Knip did not return valid JSON output:\n${text}`);
    }

    return text.slice(startIndex, endIndex + 1);
}

function normalizeReport(knipRaw, entryFiles) {
    const files = Array.isArray(knipRaw.files) ? [...knipRaw.files].sort() : [];
    const issues = Array.isArray(knipRaw.issues) ? knipRaw.issues : [];
    const packageIssue = issues.find(issue => issue && issue.file === "package.json") || {};

    const dependencies = (packageIssue.dependencies || []).map(dep => ({
        name: dep.name,
        line: dep.line || null,
        col: dep.col || null,
    }));

    const devDependencies = (packageIssue.devDependencies || []).map(dep => ({
        name: dep.name,
        line: dep.line || null,
        col: dep.col || null,
    }));

    const exports = [];
    for (const issue of issues) {
        if (!issue || issue.file === "package.json" || !Array.isArray(issue.exports)) continue;
        for (const symbol of issue.exports) {
            exports.push({
                file: issue.file,
                name: symbol.name,
                line: symbol.line || null,
                col: symbol.col || null,
            });
        }
    }

    exports.sort((a, b) => {
        if (a.file !== b.file) return a.file.localeCompare(b.file);
        return (a.line || 0) - (b.line || 0);
    });

    return {
        generatedAt: new Date().toISOString(),
        entryFiles,
        totals: {
            files: files.length,
            dependencies: dependencies.length,
            devDependencies: devDependencies.length,
            exports: exports.length,
        },
        files,
        dependencies,
        devDependencies,
        exports,
    };
}

function buildSummary(report) {
    const lines = [];
    lines.push("Frontend Unused Code Report");
    lines.push(`Generated At: ${report.generatedAt}`);
    lines.push("");
    lines.push("Entry Files:");
    for (const entry of report.entryFiles) {
        lines.push(`- ${entry}`);
    }
    lines.push("");
    lines.push(`Unused Files: ${report.totals.files}`);
    lines.push(`Unused Dependencies: ${report.totals.dependencies}`);
    lines.push(`Unused DevDependencies: ${report.totals.devDependencies}`);
    lines.push(`Unused Exports: ${report.totals.exports}`);
    lines.push("");

    lines.push("Unused Files List:");
    for (const filePath of report.files) {
        lines.push(`- ${filePath}`);
    }
    lines.push("");

    lines.push("Unused Dependencies List:");
    for (const dep of report.dependencies) {
        lines.push(`- ${dep.name}`);
    }
    lines.push("");

    lines.push("Unused DevDependencies List:");
    for (const dep of report.devDependencies) {
        lines.push(`- ${dep.name}`);
    }
    lines.push("");

    lines.push("Unused Exports List:");
    for (const item of report.exports) {
        const position = item.line ? `:${item.line}${item.col ? `:${item.col}` : ""}` : "";
        lines.push(`- ${item.file}${position} -> ${item.name}`);
    }

    return lines.join("\n");
}

function hasAnyIssue(report) {
    return (
        report.totals.files > 0
        || report.totals.dependencies > 0
        || report.totals.devDependencies > 0
        || report.totals.exports > 0
    );
}

function main() {
    ensureOutputDir();

    const targets = readBuildTargets();
    const entryFiles = collectEntryFiles(targets);
    const knipConfig = createKnipConfig(entryFiles);
    fs.writeFileSync(GENERATED_CONFIG_PATH, JSON.stringify(knipConfig, null, 2) + "\n", "utf8");

    log(`Using ${entryFiles.length} entry files from build.targets.json`);

    const result = runKnip(GENERATED_CONFIG_PATH);
    if (result.error) {
        throw new Error(`Failed to execute knip: ${result.error.message}`);
    }

    const rawJsonText = extractJson(result.stdout);
    fs.writeFileSync(RAW_REPORT_PATH, rawJsonText + "\n", "utf8");

    let knipRaw;
    try {
        knipRaw = JSON.parse(rawJsonText);
    } catch (error) {
        throw new Error(`Failed to parse knip JSON output: ${error.message}`);
    }

    const report = normalizeReport(knipRaw, entryFiles);
    const summary = buildSummary(report);

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    fs.writeFileSync(SUMMARY_PATH, summary + "\n", "utf8");

    log(`Report written: ${toPosix(path.relative(ROOT_DIR, REPORT_PATH))}`);
    log(`Summary written: ${toPosix(path.relative(ROOT_DIR, SUMMARY_PATH))}`);
    log(`Raw knip output: ${toPosix(path.relative(ROOT_DIR, RAW_REPORT_PATH))}`);

    log(`Unused files: ${report.totals.files}`);
    log(`Unused dependencies: ${report.totals.dependencies}`);
    log(`Unused devDependencies: ${report.totals.devDependencies}`);
    log(`Unused exports: ${report.totals.exports}`);

    if (result.status !== 0 && STRICT_MODE) {
        process.exitCode = result.status;
        return;
    }

    if (STRICT_MODE && hasAnyIssue(report)) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(`[scan:unused:frontend] ${error.message}`);
    process.exitCode = 1;
}
