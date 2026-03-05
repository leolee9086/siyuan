#!/usr/bin/env node

/**
 * Check whether exports in imports.ts gateway files are actually used
 * by files in the same module directory tree.
 *
 * Default target: all imports.ts files under app/src
 */

const fs = require("fs");
const path = require("path");

function loadTypeScript(cwd) {
    const tsPath = path.join(cwd, "node_modules", "typescript");
    try {
        return require(tsPath);
    } catch (error) {
        try {
            return require("typescript");
        } catch (globalError) {
            throw new Error(
                `Cannot load typescript from ${cwd}. Please install dependencies first.\n` +
                `Original error: ${error.message}`
            );
        }
    }
}

const SOURCE_EXTENSIONS = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
]);

const RESOLVE_EXTENSIONS = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".mts",
    ".cts",
    ".vue",
];

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        cwd: null,
        target: null,
        json: false,
        help: false,
    };

    for (let index = 0; index < args.length; index++) {
        const arg = args[index];
        if (arg === "--cwd") {
            options.cwd = args[++index];
            continue;
        }
        if (arg === "--target") {
            options.target = args[++index];
            continue;
        }
        if (arg === "--json") {
            options.json = true;
            continue;
        }
        if (arg === "--help" || arg === "-h") {
            options.help = true;
            continue;
        }
    }

    return options;
}

function showHelp() {
    console.log(`
Imports gateway usage checker

Usage:
  node ./scripts/check-imports-gateway-usage.js [options]

Options:
  --target <path>   Check a specific imports.ts file or a directory recursively
  --cwd <dir>       Working directory (default: app directory)
  --json            Output JSON format
  --help, -h        Show this help

Examples:
  pnpm lint:imports-gateway
  pnpm lint:imports-gateway -- --target src/protyle/breadcrumb/menu/imports.ts
  pnpm lint:imports-gateway -- --target src/protyle --json
`);
}

function toAbsolute(cwd, inputPath) {
    if (!inputPath) {
        return "";
    }
    if (path.isAbsolute(inputPath)) {
        return path.normalize(inputPath);
    }
    return path.resolve(cwd, inputPath);
}

function normalizePath(filePath) {
    return path.resolve(filePath).replace(/\\/g, "/");
}

function fileExists(filePath) {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function dirExists(dirPath) {
    return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

function collectFilesRecursively(dirPath, predicate, fileList = []) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === ".git") {
                continue;
            }
            collectFilesRecursively(fullPath, predicate, fileList);
            continue;
        }
        if (predicate(fullPath)) {
            fileList.push(path.normalize(fullPath));
        }
    }
    return fileList;
}

function discoverGatewayFiles(srcRoot, targetPath) {
    if (!targetPath) {
        if (!dirExists(srcRoot)) {
            throw new Error(`Source directory not found: ${srcRoot}`);
        }
        return collectFilesRecursively(
            srcRoot,
            (fullPath) => path.basename(fullPath) === "imports.ts"
        );
    }

    if (fileExists(targetPath)) {
        if (path.basename(targetPath) !== "imports.ts") {
            throw new Error(`Target file must be imports.ts: ${targetPath}`);
        }
        return [path.normalize(targetPath)];
    }

    if (dirExists(targetPath)) {
        return collectFilesRecursively(
            targetPath,
            (fullPath) => path.basename(fullPath) === "imports.ts"
        );
    }

    throw new Error(`Target path not found: ${targetPath}`);
}

function getScriptKind(ts, filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".ts") {
        return ts.ScriptKind.TS;
    }
    if (extension === ".tsx") {
        return ts.ScriptKind.TSX;
    }
    if (extension === ".js") {
        return ts.ScriptKind.JS;
    }
    if (extension === ".jsx") {
        return ts.ScriptKind.JSX;
    }
    if (extension === ".mjs" || extension === ".cjs") {
        return ts.ScriptKind.JS;
    }
    if (extension === ".mts" || extension === ".cts") {
        return ts.ScriptKind.TS;
    }
    return ts.ScriptKind.Unknown;
}

function hasModifier(ts, node, kind) {
    if (!node.modifiers) {
        return false;
    }
    return node.modifiers.some((modifier) => modifier.kind === kind);
}

function ensureExportSymbol(map, name) {
    if (!map.has(name)) {
        map.set(name, {
            name,
            valueExported: false,
            typeExported: false,
            lines: [],
        });
    }
    return map.get(name);
}

function addExportSymbol(ts, map, sourceFile, name, isTypeOnly, node) {
    const symbol = ensureExportSymbol(map, name);
    if (isTypeOnly) {
        symbol.typeExported = true;
    } else {
        symbol.valueExported = true;
    }
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    symbol.lines.push(position.line + 1);
}

function collectGatewayExports(ts, gatewayFilePath) {
    const content = fs.readFileSync(gatewayFilePath, "utf8");
    const sourceFile = ts.createSourceFile(
        gatewayFilePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(ts, gatewayFilePath)
    );

    const exportSymbols = new Map();

    for (const statement of sourceFile.statements) {
        if (ts.isExportDeclaration(statement)) {
            if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) {
                continue;
            }
            for (const element of statement.exportClause.elements) {
                const exportedName = element.name.text;
                const isTypeOnly = Boolean(statement.isTypeOnly || element.isTypeOnly);
                addExportSymbol(ts, exportSymbols, sourceFile, exportedName, isTypeOnly, element.name);
            }
            continue;
        }

        if (ts.isVariableStatement(statement) && hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)) {
            for (const declaration of statement.declarationList.declarations) {
                if (!ts.isIdentifier(declaration.name)) {
                    continue;
                }
                addExportSymbol(ts, exportSymbols, sourceFile, declaration.name.text, false, declaration.name);
            }
            continue;
        }

        if (ts.isFunctionDeclaration(statement) && statement.name && hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)) {
            addExportSymbol(ts, exportSymbols, sourceFile, statement.name.text, false, statement.name);
            continue;
        }

        if (ts.isClassDeclaration(statement) && statement.name && hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)) {
            addExportSymbol(ts, exportSymbols, sourceFile, statement.name.text, false, statement.name);
            continue;
        }

        if (ts.isInterfaceDeclaration(statement) && hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)) {
            addExportSymbol(ts, exportSymbols, sourceFile, statement.name.text, true, statement.name);
            continue;
        }

        if (ts.isTypeAliasDeclaration(statement) && hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)) {
            addExportSymbol(ts, exportSymbols, sourceFile, statement.name.text, true, statement.name);
            continue;
        }

        if (ts.isEnumDeclaration(statement) && hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)) {
            addExportSymbol(ts, exportSymbols, sourceFile, statement.name.text, false, statement.name);
        }
    }

    return Array.from(exportSymbols.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function resolveRelativeImportPath(sourceFilePath, moduleSpecifier) {
    if (!moduleSpecifier.startsWith(".")) {
        return "";
    }

    const fromDir = path.dirname(sourceFilePath);
    const resolvedBasePath = path.resolve(fromDir, moduleSpecifier);
    const hasExtension = path.extname(resolvedBasePath) !== "";
    const candidates = [];

    if (hasExtension) {
        candidates.push(resolvedBasePath);
    }
    if (!hasExtension) {
        for (const extension of RESOLVE_EXTENSIONS) {
            candidates.push(resolvedBasePath + extension);
        }
        for (const extension of RESOLVE_EXTENSIONS) {
            candidates.push(path.join(resolvedBasePath, "index" + extension));
        }
    }

    for (const candidate of candidates) {
        if (fileExists(candidate)) {
            return path.normalize(candidate);
        }
    }

    return "";
}

function createUsageTracker() {
    return {
        valueCount: 0,
        typeCount: 0,
        files: new Set(),
    };
}

function addUsage(usageMap, exportName, filePath, isTypeOnly) {
    if (!usageMap.has(exportName)) {
        usageMap.set(exportName, createUsageTracker());
    }
    const usage = usageMap.get(exportName);
    if (isTypeOnly) {
        usage.typeCount += 1;
    } else {
        usage.valueCount += 1;
    }
    usage.files.add(filePath);
}

function collectModuleSourceFiles(moduleDir, gatewayFilePath) {
    const normalizedGateway = normalizePath(gatewayFilePath);
    return collectFilesRecursively(
        moduleDir,
        (fullPath) => {
            const normalized = normalizePath(fullPath);
            if (normalized === normalizedGateway) {
                return false;
            }
            const extension = path.extname(fullPath).toLowerCase();
            if (!SOURCE_EXTENSIONS.has(extension)) {
                return false;
            }
            if (fullPath.endsWith(".d.ts")) {
                return false;
            }
            return true;
        }
    );
}

function collectGatewayUsagesInFile(ts, consumerFilePath, gatewayFilePath) {
    const content = fs.readFileSync(consumerFilePath, "utf8");
    const sourceFile = ts.createSourceFile(
        consumerFilePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(ts, consumerFilePath)
    );

    const normalizedGateway = normalizePath(gatewayFilePath);
    const usageMap = new Map();
    const namespaceImports = new Set();
    let hasExportAllFromGateway = false;

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement)) {
            if (!ts.isStringLiteral(statement.moduleSpecifier)) {
                continue;
            }
            const moduleSpecifier = statement.moduleSpecifier.text;
            const resolved = resolveRelativeImportPath(consumerFilePath, moduleSpecifier);
            if (!resolved || normalizePath(resolved) !== normalizedGateway) {
                continue;
            }

            const importClause = statement.importClause;
            if (!importClause) {
                continue;
            }

            if (importClause.name) {
                addUsage(usageMap, "default", consumerFilePath, Boolean(importClause.isTypeOnly));
            }

            const namedBindings = importClause.namedBindings;
            if (!namedBindings) {
                continue;
            }

            if (ts.isNamedImports(namedBindings)) {
                for (const element of namedBindings.elements) {
                    const importedName = element.propertyName ? element.propertyName.text : element.name.text;
                    const isTypeOnly = Boolean(importClause.isTypeOnly || element.isTypeOnly);
                    addUsage(usageMap, importedName, consumerFilePath, isTypeOnly);
                }
                continue;
            }

            if (ts.isNamespaceImport(namedBindings)) {
                namespaceImports.add(namedBindings.name.text);
            }
            continue;
        }

        if (ts.isExportDeclaration(statement)) {
            if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) {
                continue;
            }

            const moduleSpecifier = statement.moduleSpecifier.text;
            const resolved = resolveRelativeImportPath(consumerFilePath, moduleSpecifier);
            if (!resolved || normalizePath(resolved) !== normalizedGateway) {
                continue;
            }

            if (!statement.exportClause) {
                hasExportAllFromGateway = true;
                continue;
            }

            if (!ts.isNamedExports(statement.exportClause)) {
                continue;
            }

            for (const element of statement.exportClause.elements) {
                const importedName = element.propertyName ? element.propertyName.text : element.name.text;
                const isTypeOnly = Boolean(statement.isTypeOnly || element.isTypeOnly);
                addUsage(usageMap, importedName, consumerFilePath, isTypeOnly);
            }
        }
    }

    if (namespaceImports.size > 0) {
        const scanNamespaceUsage = (node) => {
            if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
                const namespaceName = node.expression.text;
                if (namespaceImports.has(namespaceName)) {
                    addUsage(usageMap, node.name.text, consumerFilePath, false);
                }
            }

            if (ts.isQualifiedName(node) && ts.isIdentifier(node.left)) {
                const namespaceName = node.left.text;
                if (namespaceImports.has(namespaceName)) {
                    addUsage(usageMap, node.right.text, consumerFilePath, true);
                }
            }

            if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
                const namespaceName = node.expression.text;
                if (namespaceImports.has(namespaceName) && ts.isStringLiteral(node.argumentExpression)) {
                    addUsage(usageMap, node.argumentExpression.text, consumerFilePath, false);
                }
            }

            ts.forEachChild(node, scanNamespaceUsage);
        };
        scanNamespaceUsage(sourceFile);
    }

    return {
        usageMap,
        hasExportAllFromGateway,
    };
}

function mergeUsageMaps(target, incoming) {
    for (const [exportName, usage] of incoming.entries()) {
        if (!target.has(exportName)) {
            target.set(exportName, createUsageTracker());
        }
        const targetUsage = target.get(exportName);
        targetUsage.valueCount += usage.valueCount;
        targetUsage.typeCount += usage.typeCount;
        for (const filePath of usage.files) {
            targetUsage.files.add(filePath);
        }
    }
}

function analyzeGatewayFile(ts, gatewayFilePath) {
    const moduleDir = path.dirname(gatewayFilePath);
    const exports = collectGatewayExports(ts, gatewayFilePath);
    const moduleFiles = collectModuleSourceFiles(moduleDir, gatewayFilePath);
    const usageMap = new Map();
    let hasExportAllFromGateway = false;

    for (const moduleFile of moduleFiles) {
        const usageResult = collectGatewayUsagesInFile(ts, moduleFile, gatewayFilePath);
        mergeUsageMaps(usageMap, usageResult.usageMap);
        if (usageResult.hasExportAllFromGateway) {
            hasExportAllFromGateway = true;
        }
    }

    const unusedExports = [];
    if (!hasExportAllFromGateway) {
        for (const symbol of exports) {
            const usage = usageMap.get(symbol.name);
            const hasUsage = Boolean(usage && (usage.typeCount > 0 || usage.valueCount > 0));
            if (!hasUsage) {
                unusedExports.push(symbol);
            }
        }
    }

    return {
        gatewayFilePath: path.normalize(gatewayFilePath),
        moduleDir: path.normalize(moduleDir),
        exportCount: exports.length,
        moduleFileCount: moduleFiles.length,
        hasExportAllFromGateway,
        unusedExports,
    };
}

function formatTextReport(cwd, results) {
    const lines = [];
    const withProblems = results.filter((item) => item.unusedExports.length > 0);

    lines.push(`Checked ${results.length} gateway file(s).`);
    const totalExports = results.reduce((total, item) => total + item.exportCount, 0);
    lines.push(`Total exported symbols: ${totalExports}`);
    lines.push(`Gateways with unused exports: ${withProblems.length}`);

    if (withProblems.length === 0) {
        lines.push("No unused gateway exports found.");
        return lines.join("\n");
    }

    lines.push("");
    for (const item of withProblems) {
        lines.push(`- ${path.relative(cwd, item.gatewayFilePath).replace(/\\/g, "/")}`);
        for (const symbol of item.unusedExports) {
            const line = symbol.lines.length > 0 ? symbol.lines[0] : "?";
            const kind = symbol.valueExported && symbol.typeExported
                ? "value+type"
                : (symbol.typeExported ? "type" : "value");
            lines.push(`  ${symbol.name} (${kind}, line ${line})`);
        }
    }

    return lines.join("\n");
}

function createJsonReport(cwd, results) {
    const withProblems = results.filter((item) => item.unusedExports.length > 0);
    return {
        timestamp: new Date().toISOString(),
        checkedGateways: results.length,
        gatewaysWithUnusedExports: withProblems.length,
        totalExports: results.reduce((total, item) => total + item.exportCount, 0),
        results: results.map((item) => ({
            gatewayFilePath: path.relative(cwd, item.gatewayFilePath).replace(/\\/g, "/"),
            moduleDir: path.relative(cwd, item.moduleDir).replace(/\\/g, "/"),
            exportCount: item.exportCount,
            moduleFileCount: item.moduleFileCount,
            hasExportAllFromGateway: item.hasExportAllFromGateway,
            unusedExports: item.unusedExports.map((symbol) => ({
                name: symbol.name,
                kind: symbol.valueExported && symbol.typeExported
                    ? "value+type"
                    : (symbol.typeExported ? "type" : "value"),
                lines: symbol.lines,
            })),
        })),
    };
}

async function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    const cwd = toAbsolute(process.cwd(), options.cwd || path.join(__dirname, ".."));
    const targetPath = options.target ? toAbsolute(cwd, options.target) : "";
    const srcRoot = path.join(cwd, "src");

    if (!dirExists(cwd)) {
        throw new Error(`Working directory does not exist: ${cwd}`);
    }

    const ts = loadTypeScript(cwd);
    const gatewayFiles = discoverGatewayFiles(srcRoot, targetPath);

    if (gatewayFiles.length === 0) {
        throw new Error("No imports.ts files found.");
    }

    const results = gatewayFiles
        .map((gatewayFile) => analyzeGatewayFile(ts, gatewayFile))
        .sort((a, b) => a.gatewayFilePath.localeCompare(b.gatewayFilePath));

    if (options.json) {
        console.log(JSON.stringify(createJsonReport(cwd, results), null, 2));
    } else {
        console.log(formatTextReport(cwd, results));
    }

    const hasProblem = results.some((item) => item.unusedExports.length > 0);
    process.exit(hasProblem ? 1 : 0);
}

if (require.main === module) {
    main().catch((error) => {
        console.error(`Check failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    main,
    parseArgs,
    discoverGatewayFiles,
    analyzeGatewayFile,
};
