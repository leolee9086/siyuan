import {defineConfig} from "vitest/config";
import {integrationTestFiles} from "./scripts/test-files.mjs";

export default defineConfig({
    test: {
        include: integrationTestFiles(),
        environment: "node",
    },
});
