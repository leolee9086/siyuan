#!/usr/bin/env node

/**
 * 扫描无外部使用的导出符号。
 *
 * 通过 TypeScript Language Service 统计每个导出符号在项目中的外部引用次数
 * （排除声明文件自身的引用、排除定义位置本身），外部引用次数为 0 的
 * 导出符号即视为"无外部使用"，应去掉 export 或改用内部声明。
 *
 * 覆盖的导出声明类型：函数、类、枚举、类型别名、接口、变量（const/let/var）。
 *
 * 用法：
 *   node ./scripts/checker/scanUnusedExports.js                 # 扫描 src/ + test/ 全仓
 *   node ./scripts/checker/scanUnusedExports.js --file=src/a.ts # 仅扫描指定文件
 *   node ./scripts/checker/scanUnusedExports.js --dir=src/foo   # 仅扫描指定目录
 *   node ./scripts/checker/scanUnusedExports.js --strict        # 发现无外部使用时以退出码 1 结束
 *   node ./scripts/checker/scanUnusedExports.js --exclude=src/magi # 排除指定目录（可重复）
 *
 * 豁免方式：
 *   在导出声明前的注释中添加 @内部导出 标记，即可跳过对该导出的检查。
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

const REPORT_PATH = path.join(OUTPUT_DIR, "unused-exports.report.json");
const SUMMARY_PATH = path.join(OUTPUT_DIR, "unused-exports.summary.txt");

const EXEMPT_COMMENT = "@内部导出";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".vue"]);
const VUE_TS_LANGS = new Set(["ts", "tsx"]);
const PREVIEW_LIMIT = 30;

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

function resolveArg(argv, name) {
    const prefix = `${name}=`;
    return argv.filter((item) => item.startsWith(prefix)).map((item) => item.slice(prefix.length).trim());
}

function log(message) {
    console.log(`[scan:unused:exports] ${message}`);
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

function createAnalysisFiles(targetPaths) {
    const files = new Map();
    const declarationFiles = [];
    let scannedVueFiles = 0;
    let virtualVueBlockCount = 0;

    const roots = targetPaths.length > 0 ? targetPaths : [SRC_DIR, TEST_DIR];

    for (const rootPath of roots) {
        let absPaths;
        if (targetPaths.length > 0) {
            // 单文件目标直接处理，目录目标递归收集
            const stat = fs.statSync(rootPath);
            absPaths = stat.isDirectory()
                ? listFilesRecursively(rootPath)
                : [rootPath];
        } else {
            absPaths = listFilesRecursively(rootPath);
        }

        for (const absPath of absPaths) {
            const normalizedAbsPath = path.normalize(absPath);
            const ext = path.extname(normalizedAbsPath).toLowerCase();

            if (!SOURCE_EXTENSIONS.has(ext)) {
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

function hasExportModifier(node) {
    return Array.isArray(node.modifiers)
        && node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
}

function resolveDeclarationKind(node) {
    if (ts.isFunctionDeclaration(node)) {
        return "function";
    }
    if (ts.isClassDeclaration(node)) {
        return "class";
    }
    if (ts.isEnumDeclaration(node)) {
        return "enum";
    }
    if (ts.isTypeAliasDeclaration(node)) {
        return "type";
    }
    if (ts.isInterfaceDeclaration(node)) {
        return "interface";
    }
    if (ts.isVariableStatement(node)) {
        return "variable";
    }
    return "declaration";
}

function hasExemptComment(sourceFile, node) {
    // getFullStart 返回节点起始位置（含前置注释与 JSDoc），getLeadingCommentRanges
    // 从该位置向后收集紧邻注释
    const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
    if (!ranges) {
        return false;
    }
    return ranges.some((range) =>
        sourceFile.text.slice(range.pos, range.end).includes(EXEMPT_COMMENT));
}

function collectExportedDeclarations(program, declarationFiles) {
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
            const exportableNames = collectExportableNames(node);
            for (const nameNode of exportableNames) {
                const symbol = checker.getSymbolAtLocation(nameNode);
                if (symbol && !seenSymbols.has(symbol)) {
                    const position = sourceFile.getLineAndCharacterOfPosition(nameNode.getStart(sourceFile));
                    const declarationStart = node.getStart(sourceFile);
                    seenSymbols.set(symbol, true);
                    declarationList.push({
                        symbol,
                        name: nameNode.text,
                        kind: resolveDeclarationKind(node),
                        fileName,
                        displayFileName: toRootRelative(fileName),
                        line: position.line + 1,
                        column: position.character + 1,
                        namePosition: nameNode.getStart(sourceFile),
                        declarationStart,
                        declarationEnd: node.end,
                        exempt: hasExemptComment(sourceFile, node),
                    });
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

function collectExportableNames(node) {
    if (!hasExportModifier(node)) {
        return [];
    }

    if (ts.isVariableStatement(node)) {
        // VariableStatement 本身没有 name，需要遍历其 declarationList 中的每个声明符
        return node.declarationList.declarations
            .filter((declaration) => ts.isIdentifier(declaration.name))
            .map((declaration) => declaration.name);
    }

    if (node.name && ts.isIdentifier(node.name)) {
        return [node.name];
    }

    return [];
}

function collectExternalUsage(languageService, declaration) {
    const referenceGroups = languageService.findReferences(declaration.fileName, declaration.namePosition) || [];
    const uniqueReferences = new Map();

    const declarationNormalizedFile = path.normalize(declaration.fileName);

    for (const group of referenceGroups) {
        for (const reference of group.references || []) {
            if (reference.isDefinition) {
                continue;
            }

            // 外部使用指被其他文件引用；声明文件自身的引用（含自引用）不属于外部使用
            if (path.normalize(reference.fileName) === declarationNormalizedFile) {
                continue;
            }

            const referenceKey = `${reference.fileName}:${reference.textSpan.start}:${reference.textSpan.length}`;
            if (!uniqueReferences.has(referenceKey)) {
                uniqueReferences.set(referenceKey, reference);
            }
        }
    }

    return uniqueReferences.size;
}

function resolveTargetPaths(argv, excludePatterns) {
    const fileArgs = resolveArg(argv, "--file");
    const dirArgs = resolveArg(argv, "--dir");
    const excludeArgs = resolveArg(argv, "--exclude");

    if (fileArgs.length > 0 && dirArgs.length > 0) {
        throw new Error("Use either --file or --dir, not both");
    }

    const normalizePath = (value) => {
        const resolved = path.resolve(ROOT_DIR, value);
        if (!fs.existsSync(resolved)) {
            throw new Error(`Path does not exist: ${value}`);
        }
        return resolved;
    };

    const rawTargets = fileArgs.length > 0 ? fileArgs : dirArgs;
    const targets = rawTargets.map(normalizePath);

    for (const excludeValue of excludeArgs) {
        const excluded = normalizePath(excludeValue);
        excludePatterns.push(toPosix(excluded));
    }

    if (targets.length === 0) {
        return [];
    }

    return targets;
}

function isExcluded(absPath, excludePatterns) {
    if (excludePatterns.length === 0) {
        return false;
    }
    const normalized = toPosix(absPath);
    return excludePatterns.some((pattern) => normalized === pattern || normalized.startsWith(`${pattern}/`));
}

function buildSummary(report) {
    const lines = [];
    lines.push("Unused Exports Report");
    lines.push(`Generated At: ${report.generatedAt}`);
    lines.push(`Target: ${report.target}`);
    lines.push(`Strict Mode: ${report.strictMode}`);
    lines.push("");
    lines.push("Stats:");
    lines.push(`- Files Scanned: ${report.stats.fileCount}`);
    lines.push(`- Vue TS Blocks: ${report.stats.virtualVueBlockCount}`);
    lines.push(`- Exported Declarations Scanned: ${report.stats.exportedDeclarationCount}`);
    lines.push(`- Unused Exports: ${report.stats.unusedExportCount}`);
    lines.push("");
    lines.push("Unused Exports:");

    if (report.unusedExports.length === 0) {
        lines.push("- (none)");
        return lines.join("\n");
    }

    for (const item of report.unusedExports) {
        lines.push(`- ${item.kind} ${item.name} -> ${item.file}:${item.line}:${item.column}${item.exempt ? " [已豁免]" : ""}`);
    }

    return lines.join("\n");
}

function main() {
    ensureOutputDir();

    const STRICT_MODE = process.argv.includes("--strict");
    const excludePatterns = [];
    const targetPaths = resolveTargetPaths(process.argv, excludePatterns);

    const compilerOptions = readCompilerOptions();
    const analysisResult = createAnalysisFiles(targetPaths);
    const languageService = createLanguageService(compilerOptions, analysisResult.files);
    const program = languageService.getProgram();

    if (!program) {
        throw new Error("Failed to create TypeScript program");
    }

    const declarations = collectExportedDeclarations(program, analysisResult.declarationFiles);
    const unusedExports = [];

    for (const declaration of declarations) {
        if (declaration.exempt) {
            continue;
        }

        const usageCount = collectExternalUsage(languageService, declaration);
        if (usageCount > 0) {
            continue;
        }

        unusedExports.push({
            name: declaration.name,
            kind: declaration.kind,
            file: declaration.displayFileName,
            line: declaration.line,
            column: declaration.column,
            exempt: declaration.exempt,
        });
    }

    unusedExports.sort((left, right) => {
        if (left.file !== right.file) {
            return left.file.localeCompare(right.file);
        }
        return left.line - right.line;
    });

    const report = {
        generatedAt: new Date().toISOString(),
        target: targetPaths.length > 0
            ? targetPaths.map((targetPath) => toRootRelative(targetPath)).join(", ")
            : "src/ + test/",
        strictMode: STRICT_MODE,
        stats: {
            fileCount: analysisResult.declarationFiles.length,
            virtualVueBlockCount: analysisResult.virtualVueBlockCount,
            exportedDeclarationCount: declarations.length,
            unusedExportCount: unusedExports.length,
        },
        unusedExports,
    };

    const summary = buildSummary(report);

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
    fs.writeFileSync(SUMMARY_PATH, summary + "\n", "utf8");

    log(`Exported declarations scanned: ${report.stats.exportedDeclarationCount}`);
    log(`Unused exports found: ${report.stats.unusedExportCount}`);

    const previewItems = unusedExports.slice(0, PREVIEW_LIMIT);
    for (const item of previewItems) {
        log(`- ${item.kind} ${item.name} -> ${item.file}:${item.line}:${item.column}`);
    }

    if (unusedExports.length > PREVIEW_LIMIT) {
        log(`... and ${unusedExports.length - PREVIEW_LIMIT} more. See ${toRootRelative(SUMMARY_PATH)}`);
    }

    log(`Report written: ${toRootRelative(REPORT_PATH)}`);
    log(`Summary written: ${toRootRelative(SUMMARY_PATH)}`);

    if (STRICT_MODE && unusedExports.length > 0) {
        process.exitCode = 1;
    }
}

try {
    main();
} catch (error) {
    console.error(`[scan:unused:exports] ${error.message}`);
    process.exitCode = 1;
}
