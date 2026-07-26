import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import ts from "typescript";

const isImportsGateway = (filePath) => path.basename(filePath) === "imports.ts";

const isGatewaySpecifier = (specifier) =>
    specifier.startsWith(".") && path.basename(specifier) === "imports";

export const collectGatewayHopsFromSource = (filePath, sourceText) => {
    if (!isImportsGateway(filePath)) {
        return [];
    }
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    return sourceFile.statements.flatMap((statement) => {
        const moduleSpecifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement))
            ? statement.moduleSpecifier
            : undefined;
        if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier) || !isGatewaySpecifier(moduleSpecifier.text)) {
            return [];
        }
        return [{
            filePath,
            line: sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1,
            specifier: moduleSpecifier.text,
        }];
    });
};

const walkImportsGateways = (directory) => fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
        return walkImportsGateways(entryPath);
    }
    return entry.isFile() && isImportsGateway(entryPath) ? [entryPath] : [];
});

export const findImportsGatewayHops = (sourceRoot) => walkImportsGateways(sourceRoot).flatMap((filePath) =>
    collectGatewayHopsFromSource(filePath, fs.readFileSync(filePath, "utf8")));

const main = () => {
    const sourceRoot = path.resolve(process.cwd(), "src");
    const hops = findImportsGatewayHops(sourceRoot);
    if (hops.length === 0) {
        console.log("No imports.ts gateway hops found in app/src.");
        return;
    }
    hops.forEach(({filePath, line, specifier}) => {
        const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
        console.error(`${relativePath}:${line}: imports.ts must resolve directly instead of forwarding ${specifier}`);
    });
    process.exitCode = 1;
};

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryPath) {
    main();
}
