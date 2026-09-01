import fs from "node:fs";
import path from "node:path";

const appRoot = path.resolve(import.meta.dirname, "..");
const testRoots = ["src", "test"];
const testFilePattern = /(?:^|[./])[^/]+(?:\.test|\.spec)\.(?:[cm]?[jt]sx?)$/;
const integrationPatterns = [
    /forge-runtime-supervisor\.integration\.test\.js$/,
    /test\/util\/embedding\/(?:embeddingApi|frontendEmbedding|collectionProtection|vectorApi\.performance)\.test\.ts$/,
];
const retiredTestFilePaths = new Set([
    "src/layout/dock/agent/AgentHistory.test.ts",
]);

const toProjectPath = (filePath) => path.relative(appRoot, filePath).replace(/\\/g, "/");

const walk = (directory) => {
    if (!fs.existsSync(directory)) {
        return [];
    }
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            return walk(entryPath);
        }
        return entry.isFile() && testFilePattern.test(entry.name) ? [entryPath] : [];
    });
};

export const allTestFiles = () => testRoots.flatMap((root) => walk(path.join(appRoot, root)))
    .map(toProjectPath)
    .sort();

export const retiredTestFiles = () => [...retiredTestFilePaths];

export const isIntegrationTest = (filePath) => integrationPatterns.some((pattern) => pattern.test(filePath));

export const nodeTestFiles = () => allTestFiles().filter((filePath) => {
    if (retiredTestFilePaths.has(filePath) || isIntegrationTest(filePath)) {
        return false;
    }
    return fs.readFileSync(path.join(appRoot, filePath), "utf8").includes("node:test");
});

export const vitestTestFiles = () => allTestFiles().filter((filePath) => {
    if (retiredTestFilePaths.has(filePath) || isIntegrationTest(filePath)) {
        return false;
    }
    return !fs.readFileSync(path.join(appRoot, filePath), "utf8").includes("node:test");
});

export const integrationTestFiles = () => allTestFiles().filter((filePath) =>
    !retiredTestFilePaths.has(filePath) && isIntegrationTest(filePath));
