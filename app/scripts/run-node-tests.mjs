import {spawnSync} from "node:child_process";
import {nodeTestFiles} from "./test-files.mjs";

const files = nodeTestFiles();
if (files.length === 0) {
    throw new Error("no Node test files were found");
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
    cwd: new URL("..", import.meta.url),
    stdio: "inherit",
});
process.exitCode = result.status ?? 1;
