import path from "node:path";
import {pathToFileURL} from "node:url";
import madge from "madge";

export const isPathInsideSource = (sourceRoot, filePath) => {
    const relative = path.relative(sourceRoot, filePath);
    return relative !== "" && relative !== ".." &&
        !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
};

export const findSourceCycles = async (workspaceRoot = process.cwd()) => {
    const sourceRoot = path.resolve(workspaceRoot, "src");
    const graph = await madge(sourceRoot, {
        fileExtensions: ["ts", "tsx"],
        tsConfig: path.resolve(workspaceRoot, "tsconfig.json"),
        dependencyFilter: (filePath) => isPathInsideSource(sourceRoot, filePath),
    });
    const dependencies = graph.obj();
    const externalNodes = Object.keys(dependencies).filter((filePath) =>
        filePath === ".." || filePath.startsWith("../") || filePath.startsWith("..\\") || path.isAbsolute(filePath));
    if (externalNodes.length > 0) {
        throw new Error(`Source cycle graph contains external nodes: ${externalNodes.join(", ")}`);
    }
    return {
        fileCount: Object.keys(dependencies).length,
        cycles: graph.circular(),
    };
};

const main = async () => {
    const result = await findSourceCycles();
    console.log(`Processed ${result.fileCount} files inside app/src`);
    if (result.cycles.length === 0) {
        console.log("No circular dependency found in app/src.");
        return;
    }
    result.cycles.forEach((cycle, index) => {
        console.log(`${index + 1}) ${cycle.join(" > ")}`);
    });
    console.error(`Found ${result.cycles.length} circular dependencies in app/src.`);
    process.exitCode = 1;
};

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === entryPath) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
