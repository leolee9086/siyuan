#!/usr/bin/env node

/**
 * 扫描仅被使用极少次数的类型声明。
 *
 * 默认扫描 usageCount 为 0 和 1 的类型（type / interface / enum）。
 *
 * 用法：
 *   node ./scripts/checker/scanLowUsageTypes.js
 *   node ./scripts/checker/scanLowUsageTypes.js --counts=0,1,2
 *   node ./scripts/checker/scanLowUsageTypes.js --max-usage=2
 *   node ./scripts/checker/scanLowUsageTypes.js --strict
 */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");
const { parse } = require("@vue/compiler-sfc");

const ROOT_DIR = path.resolve(__dirname, "../..");
const SRC_DIR = path.join(ROOT_DIR, "src");
const TEST_DIR = path.join(ROOT_DIR, "test");
const OUTPUT_DIR = path.join(ROOT_DIR, "0_lints");
const TSCONFIG_PATH = path.join(ROOT_DIR, "tsconfig.json");

const REPORT_PATH = path.join(OUTPUT_DIR, "low-usage-types.report.json");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "low-usage-types.summary.txt");

const TYPE_DECLARATION_EXTENSIONS = new Set([".ts", ".tsx"]);
const USAGE_SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".vue"]);
const VUE_TS_LANGS = new Set(["ts", "tsx"]);
const DEFAULT_USAGE_COUNTS = [0, 1];
const DEFAULT_PREVIEW_LIMIT = 20;

const IGNORE_PATTERNS = [
    /\.d\.ts$/i,
    /\.remote\.tsx?$/i,
    /\.backup\.tsx?$/i,
    /\.old\.tsx?$/i,
    /\.bak\.tsx?$/i,
    /\.ts\.(backup|old|bak)$/i,
    /[/\\]node_modules[/\\]/i,
    /[/\\]src[/\\]asset[/\\]pdf[/\\]/i,
    /[/\\]src[/\\]types[/\\]dist[/\\]/i,
    /[/\\]src[/\\]types[/\\]i18n\.types\.ts$/i,
];

const STRICT_MODE = process.argv.includes("--strict");
const PREVIEW_LIMIT = resolvePreviewLimit(process.argv);
const USAGE_COUNTS = resolveUsageCounts(process.argv);
const USAGE_COUNT_SET = new Set(USAGE_COUNTS);

function log(message) {
    console.log(`[scan:types:low-usage] ${message}`);
}

function toPosix(filePath) {
    return filePath.replace(/\\/g, "/");
}

function toRootRelative(filePath) {
    return toPosix(path.relative(ROOT_DIR, filePath));
}

function ensureOutputDir() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function resolvePreviewLimit(argv) {
    const arg = argv.find((item) => item.startsWith("--preview-limit="));
    if (!arg) {
        return DEFAULT_PREVIEW_LIMIT;
    }

    const rawValue = arg.slice("--preview-limit=".length).trim();
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --preview-limit value: ${rawValue}`);
    }
    return parsed;
}

function resolveUsageCounts(argv) {
    const countsArg = argv.find((item) => item.startsWith("--counts="));
    const maxUsageArg = argv.find((item) => item.startsWith("--max-usage="));

    if (countsArg && maxUsageArg) {
        throw new Error("Use either --counts or --max-usage, not both");
    }

    if (countsArg) {
        const rawValue = countsArg.slice("--counts=".length).trim();
        if (!rawValue) {
            throw new Error("Missing value for --counts");
        }

        const counts = rawValue
            .split(",")
            .map((item) => Number.parseInt(item.trim(), 10))
            .filter((item) => Number.isInteger(item) && item >= 0);

        if (counts.length === 0) {
            throw new Error(`Invalid --counts value: ${rawValue}`);
        }

        return Array.from(new Set(counts)).sort((left, right) => left - right);
    }

    if (maxUsageArg) {
        const rawValue = maxUsageArg.slice("--max-usage=".length).trim();
        const maxUsage = Number.parseInt(rawValue, 10);
        if (!Number.isInteger(maxUsage) || maxUsage < 0) {
            throw new Error(`Invalid --max-usage value: ${rawValue}`);
        }

        return Array.from({ length: maxUsage + 1 }, (_, index) => index);
    }

    return DEFAULT_USAGE_COUNTS;
}

function shouldIgnore(filePath) {
    const normalized = toPosix(filePath);
    return IGNORE_PATTERNS.some((pattern) => pattern.test(normalized));
}

function listFilesRecursively(dirPath, fileList = []) {
    if (!fs.existsSync(dirPath)) {
        return fileList;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            listFilesRecursively(fullPath, fileList);
            continue;
        }
        fileList.push(fullPath);
    }
    return fileList;
}

function readCompilerOptions() {
    const configFile = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
    if (configFile.error) {
        throw new Error(`Failed to read tsconfig.json: ${formatTsDiagnostic(configFile.error)}`);
    }

    const parsed = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        ROOT_DIR,
        undefined,
        TSCONFIG_PATH,
    );

    if (parsed.errors && parsed.errors.length > 0) {
        throw new Error(`Failed to parse tsconfig.json: ${parsed.errors.map(formatTsDiagnostic).join("; ")}`);
    }

    return {
        ...parsed.options,
        allowNonTsExtensions: true,
        noEmit: true,
        declaration: false,
        emitDeclarationOnly: false,
        skipLibCheck: true,
        jsx: parsed.options.jsx ?? ts.JsxEmit.Preserve,
    };
}

function formatTsDiagnostic(diagnostic) {
    return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
}

function createAnalysisFiles() {
    const roots = [SRC_DIR, TEST_DIR];
    const files = new Map();
    const declarationFiles = [];
    let scannedVueFiles = 0;
    let virtualVueBlockCount = 0;

    for (const rootPath of roots) {
        const absPaths = listFilesRecursively(rootPath);
        for (const absPath of absPaths) {
            const normalizedAbsPath = path.normalize(absPath);
            const ext = path.extname(normalizedAbsPath).toLowerCase();

            if (!USAGE_SOURCE_EXTENSIONS.has(ext)) {
                continue;
            }

            if (shouldIgnore(normalizedAbsPath)) {
                continue;
            }

            if (ext === ".ts" || ext === ".tsx") {
                const content = fs.readFileSync(normalizedAbsPath, "utf8");
                files.set(normalizedAbsPath, {
                    fileName: normalizedAbsPath,
                    content,
                    originalFileName: normalizedAbsPath,
                    displayFileName: toRootRelative(normalizedAbsPath),
                    isVirtual: false,
                });
                declarationFiles.push(normalizedAbsPath);
                continue;
            }

            if (ext === ".vue") {
                scannedVueFiles++;
                const vueBlocks = extractVueTypeScriptBlocks(normalizedAbsPath);
                for (const block of vueBlocks) {
                    files.set(block.fileName, block);
                    virtualVueBlockCount++;
                }
            }
        }
    }

    return {
        files,
        declarationFiles,
        scannedVueFiles,
        virtualVueBlockCount,
    };
}

function extractVueTypeScriptBlocks(absPath) {
    const content = fs.readFileSync(absPath, "utf8");
    const result = parse(content, { filename: absPath });
    const descriptor = result.descriptor;
    const blocks = [];

    const candidates = [
        { key: "script", block: descriptor.script },
        { key: "scriptSetup", block: descriptor.scriptSetup },
    ];

    for (const candidate of candidates) {
        if (!candidate.block || candidate.block.src) {
            continue;
        }

        const lang = String(candidate.block.lang || "").toLowerCase();
        if (!VUE_TS_LANGS.has(lang)) {
            continue;
        }

        const ext = lang === "tsx" ? ".tsx" : ".ts";
        const virtualFileName = path.normalize(`${absPath}.__${candidate.key}${ext}`);
        blocks.push({
            fileName: virtualFileName,
            content: candidate.block.content,
            originalFileName: absPath,
            displayFileName: `${toRootRelative(absPath)}#${candidate.key}`,
            isVirtual: true,
        });
    }

    return blocks;
}

function createLanguageService(compilerOptions, analysisFiles) {
    const fileNames = Array.from(analysisFiles.keys());
    const versions = new Map(fileNames.map((fileName) => [fileName, "0"]));

    const host = {
        getCompilationSettings: () => compilerOptions,
        getScriptFileNames: () => fileNames,
        getScriptVersion: (fileName) => versions.get(path.normalize(fileName)) || "0",
        getScriptSnapshot: (fileName) => {
            const normalized = path.normalize(fileName);
            const record = analysisFiles.get(normalized);
            if (record) {
                return ts.ScriptSnapshot.fromString(record.content);
            }

            if (!ts.sys.fileExists(normalized)) {
                return undefined;
            }

            const content = ts.sys.readFile(normalized);
            if (content == null) {
                return undefined;
            }

            return ts.ScriptSnapshot.fromString(content);
        },
        getCurrentDirectory: () => ROOT_DIR,
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options),
        fileExists: (fileName) => {
            const normalized = path.normalize(fileName);
            return analysisFiles.has(normalized) || ts.sys.fileExists(normalized);
        },
        readFile: (fileName) => {
            const normalized = path.normalize(fileName);
            const record = analysisFiles.get(normalized);
            if (record) {
                return record.content;
            }
            return ts.sys.readFile(normalized);
        },
        readDirectory: ts.sys.readDirectory,
        directoryExists: ts.sys.directoryExists,
        getDirectories: ts.sys.getDirectories,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        getNewLine: () => ts.sys.newLine,
    };

    return ts.createLanguageService(host, ts.createDocumentRegistry());
}

function collectTypeDeclarations(program, declarationFiles) {
    const checker = program.getTypeChecker();
    const declarationList = [];
    const seenSymbols = new Map();

    for (const fileName of declarationFiles) {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            continue;
        }

        visit(sourceFile);

        function visit(node) {
            if (
                ts.isTypeAliasDeclaration(node)
                || ts.isInterfaceDeclaration(node)
                || ts.isEnumDeclaration(node)
            ) {
                if (node.name && ts.isIdentifier(node.name)) {
                    const symbol = checker.getSymbolAtLocation(node.name);
                    if (symbol && !seenSymbols.has(symbol)) {
                        const position = sourceFile.getLineAndCharacterOfPosition(node.name.getStart(sourceFile));
                        const kind = resolveDeclarationKind(node);
                        seenSymbols.set(symbol, true);
                        declarationList.push({
                            symbol,
                            name: node.name.text,
                            kind,
                            fileName,
                            displayFileName: toRootRelative(fileName),
                            line: position.line + 1,
                            column: position.character + 1,
                            namePosition: node.name.getStart(sourceFile),
                            declarationStart: node.getStart(sourceFile),
                            declarationEnd: node.end,
                            exported: hasExportModifier(node),
                        });
                    }
                }
            }

            ts.forEachChild(node, visit);
        }
    }

    declarationList.sort((left, right) => {
        if (left.displayFileName !== right.displayFileName) {
            return left.displayFileName.localeCompare(right.displayFileName);
        }
        return left.line - right.line;
    });

    return declarationList;
}

function resolveDeclarationKind(node) {
    if (ts.isTypeAliasDeclaration(node)) {
        return "type";
    }
    if (ts.isInterfaceDeclaration(node)) {
        return "interface";
    }
    return "enum";
}

function hasExportModifier(node) {
    return Array.isArray(node.modifiers)
        && node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function collectUsageStats(languageService, declaration, analysisFiles) {
    const referenceGroups = languageService.findReferences(declaration.fileName, declaration.namePosition) || [];
    const uniqueReferences = new Map();

    for (const group of referenceGroups) {
        for (const reference of group.references || []) {
            if (reference.isDefinition) {
                continue;
            }

            if (
                reference.fileName === declaration.fileName
                && reference.textSpan.start >= declaration.declarationStart
                && reference.textSpan.start < declaration.declarationEnd
            ) {
                continue;
            }

            const referenceKey = `${reference.fileName}:${reference.textSpan.start}:${reference.textSpan.length}`;
            if (!uniqueReferences.has(referenceKey)) {
                uniqueReferences.set(referenceKey, reference);
            }
        }
    }

    const references = Array.from(uniqueReferences.values());
    const referencesByFile = new Map();

    for (const reference of references) {
        const fileRecord = analysisFiles.get(path.normalize(reference.fileName));
        const displayFileName = fileRecord
            ? fileRecord.displayFileName
            : toRootRelative(reference.fileName);
        referencesByFile.set(displayFileName, (referencesByFile.get(displayFileName) || 0) + 1);
    }

    const referenceFiles = Array.from(referencesByFile.entries())
        .map(([filePath, count]) => ({ filePath, count }))
        .sort((left, right) => {
            if (left.count !== right.count) {
                return left.count - right.count;
            }
            return left.filePath.localeCompare(right.filePath);
        });

    return {
        usageCount: references.length,
        referenceFiles,
    };
}

function buildReport(matchedTypes, stats) {
    return {
        generatedAt: new Date().toISOString(),
        usageCounts: USAGE_COUNTS,
        strictMode: STRICT_MODE,
        stats,
        matches: matchedTypes,
    };
}

function buildSummary(report) {
    const lines = [];
    lines.push("Low Usage Types Report");
    lines.push(`Generated At: ${report.generatedAt}`);
    lines.push(`Usage Counts: ${report.usageCounts.join(", ")}`);
    lines.push(`Strict Mode: ${report.strictMode ? "true" : "false"}`);
    lines.push("");
    lines.push("Stats:");
    lines.push(`- Real TypeScript Files: ${report.stats.realTypeScriptFileCount}`);
    lines.push(`- Vue TS Blocks: ${report.stats.virtualVueBlockCount}`);
    lines.push(`- Vue Files Scanned: ${report.stats.scannedVueFiles}`);
    lines.push(`- Type Declarations Scanned: ${report.stats.scannedTypeDeclarationCount}`);
    lines.push(`- Matched Types: ${report.stats.matchedTypeCount}`);
    lines.push("");
    lines.push("Matches:");

    if (report.matches.length === 0) {
        lines.push("- (none)");
        return lines.join("\n");
    }

    for (const item of report.matches) {
        const referenceList = item.referenceFiles.length > 0
            ? item.referenceFiles.map((reference) => `${reference.filePath} (${reference.count})`).join(", ")
            : "none";
        lines.push(`- [${item.usageCount}] ${item.kind} ${item.name} -> ${item.file}:${item.line}:${item.column} | exported=${item.exported ? "yes" : "no"} | refs=${referenceList}`);
    }

    return lines.join("\n");
}

function printPreview(matches) {
    if (PREVIEW_LIMIT === 0) {
        return;
    }

    if (matches.length === 0) {
        log("No low-usage types matched the current filter.");
        return;
    }

    const previewItems = matches.slice(0, PREVIEW_LIMIT);
    log(`Previewing ${previewItems.length} of ${matches.length} matched types:`);
    for (const item of previewItems) {
        const firstReference = item.referenceFiles[0]?.filePath || "none";
        log(`[${item.usageCount}] ${item.kind} ${item.name} -> ${item.file}:${item.line}:${item.column} | first-ref=${firstReference}`);
    }
}

function main() {
    ensureOutputDir();

    const compilerOptions = readCompilerOptions();
    const analysisResult = createAnalysisFiles();
    const languageService = createLanguageService(compilerOptions, analysisResult.files);
    const program = languageService.getProgram();

    if (!program) {
        throw new Error("Failed to create TypeScript program");
    }

    const declarations = collectTypeDeclarations(program, analysisResult.declarationFiles);
    const matchedTypes = [];

    for (const declaration of declarations) {
        const usageStats = collectUsageStats(languageService, declaration, analysisResult.files);
        if (!USAGE_COUNT_SET.has(usageStats.usageCount)) {
            continue;
        }

        matchedTypes.push({
            name: declaration.name,
            kind: declaration.kind,
            file: declaration.displayFileName,
            line: declaration.line,
            column: declaration.column,
            exported: declaration.exported,
            usageCount: usageStats.usageCount,
            referenceFiles: usageStats.referenceFiles,
        });
    }

    matchedTypes.sort((left, right) => {
        if (left.usageCount !== right.usageCount) {
            return left.usageCount - right.usageCount;
        }
        if (left.file !== right.file) {
            return left.file.localeCompare(right.file);
        }
        return left.line - right.line;
    });

    const stats = {
        realTypeScriptFileCount: analysisResult.declarationFiles.length,
        virtualVueBlockCount: analysisResult.virtualVueBlockCount,
        scannedVueFiles: analysisResult.scannedVueFiles,
        scannedTypeDeclarationCount: declarations.length,
        matchedTypeCount: matchedTypes.length,
    };

    const report = buildReport(matchedTypes, stats);
    const summary = buildSummary(report);

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    fs.writeFileSync(SUMMARY_PATH, summary + "\n", "utf8");

    log(`Usage count filter: ${USAGE_COUNTS.join(", ")}`);
    log(`Type declarations scanned: ${stats.scannedTypeDeclarationCount}`);
    log(`Matched types: ${stats.matchedTypeCount}`);
    log(`Report written: ${toRootRelative(REPORT_PATH)}`);
    log(`Summary written: ${toRootRelative(SUMMARY_PATH)}`);
    printPreview(matchedTypes);

    if (STRICT_MODE && matchedTypes.length > 0) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(`[scan:types:low-usage] ${error.message}`);
    process.exitCode = 1;
}
