import vue from "@vitejs/plugin-vue";
import {defineConfig} from "vitest/config";
import {integrationTestFiles, nodeTestFiles, retiredTestFiles} from "./scripts/test-files.mjs";

export default defineConfig({
    plugins: [vue()],
    define: {
        SIYUAN_VERSION: JSON.stringify("test"),
        NODE_ENV: JSON.stringify("test"),
    },
    test: {
        environment: "happy-dom",
        exclude: [...nodeTestFiles(), ...integrationTestFiles(), ...retiredTestFiles()],
    },
});
