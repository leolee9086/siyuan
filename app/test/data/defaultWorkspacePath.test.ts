import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import type {KernelClientType} from "../../src/data/kernelAPI/imports";

const testGlobals = globalThis as typeof globalThis & {
    SIYUAN_VERSION?: string;
    NODE_ENV?: string;
};
testGlobals.SIYUAN_VERSION = "test";
testGlobals.NODE_ENV = "test";

const createWorkspace = async (directories: Record<string, {name: string}[]>) => {
    const {Workspace} = await import("../../src/data/kernelAPI/defaultWorkspace");
    return new Workspace({
        readDir: async ({path}: {path: string}) => ({data: directories[path] || []}),
    } as unknown as KernelClientType);
};

describe("default workspace paths", () => {
    it("looks up nested protocol paths with POSIX operations", async () => {
        const workspace = await createWorkspace({
            "settings": [{name: "config.json"}],
        });

        assert.deepEqual(await workspace.exists("settings/config.json"), {name: "config.json"});
    });

    it("keeps root file lookup behavior", async () => {
        const workspace = await createWorkspace({
            "/": [{name: "README.md"}],
        });

        assert.deepEqual(await workspace.exists("README.md"), {name: "README.md"});
    });
});
