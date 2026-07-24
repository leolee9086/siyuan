import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {vitestTestFiles} from "./test-files.mjs";

const files = vitestTestFiles();
const groupSize = 10;
const appRoot = fileURLToPath(new URL("..", import.meta.url));
const vitestCLI = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));

for (let start = 0; start < files.length; start += groupSize) {
    const group = files.slice(start, start + groupSize);
    const result = spawnSync(process.execPath, [
        vitestCLI,
        "run",
        ...group,
        "--config",
        "vitest.config.ts",
        "--maxWorkers=1",
        "--no-file-parallelism",
    ], {cwd: appRoot, stdio: "inherit"});
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exitCode = result.status ?? 1;
        break;
    }
}
