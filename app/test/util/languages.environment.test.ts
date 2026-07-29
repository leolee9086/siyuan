import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {loadSiyuanLanguages} from "../../src/util/siyuanEnvironments/languages/environment";

const runtime = vi.hoisted(() => ({
    fetchGetAsync: vi.fn(),
}));

vi.mock("../../src/util/siyuanEnvironments/languages/imports", () => ({
    Constants: {SIYUAN_VERSION: "test-version"},
    fetchGetAsync: runtime.fetchGetAsync,
}));

describe("Siyuan language environment", () => {
    beforeEach(() => {
        runtime.fetchGetAsync.mockReset();
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {},
            writable: true,
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "siyuan");
    });

    it("validates and installs a language dictionary after the request completes", async () => {
        const languages = {cancel: "Cancel", confirm: "Confirm"};
        runtime.fetchGetAsync.mockResolvedValue(languages);

        await expect(loadSiyuanLanguages("en_US")).resolves.toBe(languages);

        expect(runtime.fetchGetAsync).toHaveBeenCalledWith("/appearance/langs/en_US.json?v=test-version");
        expect(window.siyuan.languages).toBe(languages);
    });

    it("rejects malformed language resources without publishing them", async () => {
        runtime.fetchGetAsync.mockResolvedValue([]);

        await expect(loadSiyuanLanguages("en_US")).rejects.toThrow("Language resource en_US is not an object");

        expect(window.siyuan.languages).toBeUndefined();
    });

    it("propagates request failures", async () => {
        const requestError = new Error("language request failed");
        runtime.fetchGetAsync.mockRejectedValue(requestError);

        await expect(loadSiyuanLanguages("en_US")).rejects.toBe(requestError);
        expect(window.siyuan.languages).toBeUndefined();
    });
});
