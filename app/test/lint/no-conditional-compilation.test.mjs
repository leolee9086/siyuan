import assert from "node:assert/strict";
import {readdir, readFile} from "node:fs/promises";
import {join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".vue"]);
const directivePattern = /^\s*\/\/\/\s*#(?:if|else|endif)\b/m;

const collectSourceFiles = async (directory) => {
    const entries = await readdir(directory, {withFileTypes: true});
    const files = await Promise.all(entries.map(async (entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            return collectSourceFiles(path);
        }
        const extension = entry.name.slice(entry.name.lastIndexOf("."));
        return sourceExtensions.has(extension) ? [path] : [];
    }));
    return files.flat();
};

test("production source does not contain conditional compilation directives", async () => {
    const sourceFiles = await collectSourceFiles(sourceRoot);
    const violations = [];
    for (const file of sourceFiles) {
        const source = await readFile(file, "utf8");
        if (directivePattern.test(source)) {
            violations.push(file);
        }
    }
    assert.deepEqual(violations, []);
});
