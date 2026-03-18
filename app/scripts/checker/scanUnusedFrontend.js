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
const ts = require("typescript");

const ROOT_DIR = path.resolve(__dirname, "../..");
const TARGETS_PATH = path.join(ROOT_DIR, "build.targets.json");
const SRC_DIR = path.join(ROOT_DIR, "src");
const OUTPUT_DIR = path.join(ROOT_DIR, "0_lints");

const GENERATED_CONFIG_PATH = path.join(OUTPUT_DIR, "unused-frontend.knip.config.json");
const RAW_REPORT_PATH = path.join(OUTPUT_DIR, "unused-frontend.knip.raw.json");
const REPORT_PATH = path.join(OUTPUT_DIR, "unused-frontend.report.json");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "unused-frontend.summary.txt");

const STRICT_MODE = process.argv.includes("--strict");
const PRODUCTION_MODE = process.argv.includes("--production");

const CODE_FILE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".vue",
]);

const MODULE_RESOLVE_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".vue",
    ".mjs",
    ".cjs",
];

const SPECIAL_SUFFIX_GLOBS = [
    "**/*.remote.ts",
    "**/*.backup.ts",
    "**/*.old.ts",
    "**/*.bak.ts",
    "**/*.ts.backup",
    "**/*.ts.old",
    "**/*.ts.bak",
    "**/*.old",
    "**/*.bak",
];

const SPECIAL_SUFFIX_PATTERNS = [
    /\.remote\.ts$/i,
    /\.backup\.(ts|tsx|js|jsx|mjs|cjs)$/i,
    /\.old\.(ts|tsx|js|jsx|mjs|cjs)$/i,
    /\.bak\.(ts|tsx|js|jsx|mjs|cjs)$/i,
    /\.ts\.backup$/i,
    /\.ts\.old$/i,
    /\.ts\.bak$/i,
    /\.old$/i,
    /\.bak$/i,
];

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

function collectBuildEntryFiles(targets) {
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

function isSpecialSuffixPath(filePath) {
    const normalized = toPosix(filePath);
    return SPECIAL_SUFFIX_PATTERNS.some(pattern => pattern.test(normalized));
}

function listFilesRecursively(dirPath, list = []) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            listFilesRecursively(fullPath, list);
            continue;
        }
        list.push(fullPath);
    }
    return list;
}

function extractVueScriptBlocks(content) {
    const blocks = [];
    const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match = regex.exec(content);
    while (match) {
        blocks.push(match[1] || "");
        match = regex.exec(content);
    }
    return blocks;
}

function extractDynamicImportSpecifiers(code, virtualFileName) {
    const sourceFile = ts.createSourceFile(
        virtualFileName,
        code,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );

    const specifiers = [];

    function visit(node) {
        if (
            ts.isCallExpression(node)
            && node.expression.kind === ts.SyntaxKind.ImportKeyword
            && node.arguments.length === 1
        ) {
            const arg = node.arguments[0];
            if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
                const specifier = arg.text.trim();
                if (specifier) {
                    specifiers.push(specifier);
                }
            }
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return specifiers;
}

function stripQueryAndHash(specifier) {
    const index = specifier.search(/[?#]/);
    if (index === -1) return specifier;
    return specifier.slice(0, index);
}

function tryResolveFile(absBasePath) {
    const checked = new Set();
    const candidates = [];

    function addCandidate(candidate) {
        const normalized = path.normalize(candidate);
        if (!checked.has(normalized)) {
            checked.add(normalized);
            candidates.push(normalized);
        }
    }

    addCandidate(absBasePath);

    const ext = path.extname(absBasePath).toLowerCase();
    if (!ext) {
        for (const candidateExt of MODULE_RESOLVE_EXTENSIONS) {
            addCandidate(`${absBasePath}${candidateExt}`);
        }
        for (const candidateExt of MODULE_RESOLVE_EXTENSIONS) {
            addCandidate(path.join(absBasePath, `index${candidateExt}`));
        }
    } else if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") {
        const baseWithoutExt = absBasePath.slice(0, -ext.length);
        for (const candidateExt of MODULE_RESOLVE_EXTENSIONS) {
            addCandidate(`${baseWithoutExt}${candidateExt}`);
        }
    }

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
        } catch (error) {
            // Ignore file system races/permission issues and keep resolving candidates.
        }
    }

    return null;
}

function resolveLocalModulePath(specifier, importerAbsPath) {
    const cleanedSpecifier = stripQueryAndHash(specifier.trim());
    if (!cleanedSpecifier) return null;

    let candidateBasePath = null;

    if (cleanedSpecifier.startsWith("./") || cleanedSpecifier.startsWith("../")) {
        candidateBasePath = path.resolve(path.dirname(importerAbsPath), cleanedSpecifier);
    } else if (cleanedSpecifier.startsWith("@/")) {
        candidateBasePath = path.join(SRC_DIR, cleanedSpecifier.slice(2));
    } else if (cleanedSpecifier.startsWith("src/")) {
        candidateBasePath = path.join(ROOT_DIR, cleanedSpecifier);
    } else if (cleanedSpecifier.startsWith("/src/")) {
        candidateBasePath = path.join(ROOT_DIR, cleanedSpecifier.slice(1));
    } else {
        return null;
    }

    const resolvedPath = tryResolveFile(candidateBasePath);
    if (!resolvedPath) return null;

    const relative = toPosix(path.relative(ROOT_DIR, resolvedPath));
    if (!relative.startsWith("src/")) return null;
    if (relative.endsWith(".d.ts")) return null;
    if (isSpecialSuffixPath(relative)) return null;
    return relative;
}

function shouldSkipDynamicImportScan(relativePath) {
    const normalized = toPosix(relativePath);
    if (!normalized.startsWith("src/")) return true;
    if (normalized.includes("/asset/pdf/")) return true;
    if (normalized.endsWith(".d.ts")) return true;
    if (isSpecialSuffixPath(normalized)) return true;
    return false;
}

function collectDynamicImportEntryFiles() {
    const files = listFilesRecursively(SRC_DIR);
    const dynamicEntrySet = new Set();

    let scannedFiles = 0;
    let dynamicLiteralCount = 0;
    let resolvedCount = 0;

    for (const absPath of files) {
        const ext = path.extname(absPath).toLowerCase();
        if (!CODE_FILE_EXTENSIONS.has(ext)) continue;

        const relative = toPosix(path.relative(ROOT_DIR, absPath));
        if (shouldSkipDynamicImportScan(relative)) continue;

        let rawContent = "";
        try {
            rawContent = fs.readFileSync(absPath, "utf8");
        } catch (error) {
            continue;
        }

        const codeBlocks = ext === ".vue" ? extractVueScriptBlocks(rawContent) : [rawContent];
        if (codeBlocks.length === 0) continue;

        scannedFiles++;

        for (const block of codeBlocks) {
            const specifiers = extractDynamicImportSpecifiers(block, relative);
            dynamicLiteralCount += specifiers.length;
            for (const specifier of specifiers) {
                const resolved = resolveLocalModulePath(specifier, absPath);
                if (resolved) {
                    dynamicEntrySet.add(resolved);
                    resolvedCount++;
                }
            }
        }
    }

    return {
        entryFiles: Array.from(dynamicEntrySet).sort(),
        stats: {
            scannedFiles,
            dynamicLiteralCount,
            resolvedCount,
        },
    };
}

function createKnipConfig(entryFiles) {
    return {
        entry: entryFiles,
        project: [
            "src/**/*.{ts,tsx,js,jsx,vue,scss,css}",
        ],
        // Explicitly enable Vue/Webpack plugins to improve SFC and bundler graph coverage.
        vue: true,
        webpack: {
            config: [
                "./webpack.config.js",
            ],
        },
        // Keep alias resolution aligned with project conventions.
        paths: {
            "@": [
                "./src",
            ],
            "@/*": [
                "./src/*",
            ],
        },
        ignore: [
            "src/**/*.d.ts",
            "src/types/**",
            "src/asset/pdf/**",
            ...SPECIAL_SUFFIX_GLOBS,
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

function buildSummary(report, dynamicImportStats) {
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
    lines.push("Dynamic Import Scan:");
    lines.push(`- Scanned Source Files: ${dynamicImportStats.scannedFiles}`);
    lines.push(`- import() Literals Found: ${dynamicImportStats.dynamicLiteralCount}`);
    lines.push(`- Resolved Dynamic Entries: ${dynamicImportStats.resolvedCount}`);
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
    const buildEntryFiles = collectBuildEntryFiles(targets);
    const dynamicImportResult = collectDynamicImportEntryFiles();

    const mergedEntries = new Set([
        ...buildEntryFiles,
        ...dynamicImportResult.entryFiles,
    ]);
    const entryFiles = Array.from(mergedEntries).sort();

    const knipConfig = createKnipConfig(entryFiles);
    fs.writeFileSync(GENERATED_CONFIG_PATH, JSON.stringify(knipConfig, null, 2) + "\n", "utf8");

    log(`Build target entries: ${buildEntryFiles.length}`);
    log(`Dynamic import entries: ${dynamicImportResult.entryFiles.length}`);
    log(`Total merged entries: ${entryFiles.length}`);

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
    const summary = buildSummary(report, dynamicImportResult.stats);

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    fs.writeFileSync(SUMMARY_PATH, summary + "\n", "utf8");

    log(`Report written: ${toPosix(path.relative(ROOT_DIR, REPORT_PATH))}`);
    log(`Summary written: ${toPosix(path.relative(ROOT_DIR, SUMMARY_PATH))}`);
    log(`Raw knip output: ${toPosix(path.relative(ROOT_DIR, RAW_REPORT_PATH))}`);

    log(`Unused files: ${report.totals.files}`);
    log(`Unused dependencies: ${report.totals.dependencies}`);
    log(`Unused devDependencies: ${report.totals.devDependencies}`);
    log(`Unused exports: ${report.totals.exports}`);
    log(`Dynamic imports resolved: ${dynamicImportResult.stats.resolvedCount}`);

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
