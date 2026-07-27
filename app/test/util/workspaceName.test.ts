import {beforeEach, describe, expect, it} from "vitest";
import {getWorkspaceName} from "../../src/util/processTitle";

const environment = {
    config: {system: {workspaceDir: ""}},
    languages: {workspace: "Workspace"},
};

beforeEach(() => {
    environment.config.system.workspaceDir = "";
    Object.defineProperty(window, "siyuan", {
        configurable: true,
        value: environment,
    });
});

describe("getWorkspaceName", () => {
    it("normalizes a Windows workspace path before reading its basename", () => {
        environment.config.system.workspaceDir = "D:\\notes\\project";
        expect(getWorkspaceName()).toBe("project");
    });

    it("uses the workspace label when the browser omits the absolute path", () => {
        expect(getWorkspaceName()).toBe("Workspace");
    });
});
