import {playwright} from "@vitest/browser-playwright";
import {defineConfig} from "vitest/config";

export default defineConfig({
    publicDir: "stage/build",
    test: {
        include: ["test/browser/**/*.browser.ts"],
        browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{browser: "chromium"}],
        },
    },
});
