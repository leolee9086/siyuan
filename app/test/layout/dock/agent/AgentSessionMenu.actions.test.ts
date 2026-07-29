import {describe, expect, it} from "vitest";

import {buildTaskDirectoryMenuActions} from "../../../../src/layout/dock/agent/session-panel/menu.actions";
import type {SessionIndexItem} from "../../../../src/layout/dock/agent/SessionStore.types";

function session(taskDirectory?: SessionIndexItem["taskDirectory"]): SessionIndexItem {
    return {id: "session-1", title: "Session", createdAt: 1, updatedAt: 1, taskDirectory};
}

describe("Agent session task directory menu", () => {
    it("exposes the main directory binding command when the Kernel grants the capability", () => {
        expect(buildTaskDirectoryMenuActions(session())).toEqual([{
            action: "bind-main",
            icon: "iconWorkspace",
            label: "绑定主任务目录",
        }]);
    });

    it("exposes additional permissions after the main directory is bound", () => {
        const actions = buildTaskDirectoryMenuActions(session({
            main: {id: "main", name: "main", permission: "read-write", external: true, boundAt: 1},
        }));

        expect(actions.map((action) => action.action)).toEqual(["summary", "bind-main", "add", "add", "add", "unbind"]);
        expect(actions[0]).toEqual({
            action: "summary",
            icon: "iconWorkspace",
            label: "主任务目录：main (read-write)",
            disabled: true,
        });
        expect(actions.filter((action) => action.action === "add").map((action) => action.permission)).toEqual([
            "read-only",
            "read-write",
            "command",
        ]);
    });

    it("exposes each existing grant for removal", () => {
        const actions = buildTaskDirectoryMenuActions(session({
            main: {id: "main", name: "main", permission: "read-write", external: true, boundAt: 1},
            directories: [{id: "docs", name: "docs", permission: "read-only", external: true, boundAt: 2}],
        }));

        expect(actions.find((action) => action.directoryID === "docs")).toEqual({
            action: "unbind",
            icon: "iconClose",
            label: "解除目录：docs (read-only)",
            directoryID: "docs",
        });
        expect(actions.some((action) => action.directoryID === "main")).toBe(false);
    });

    it("hides authorization-expanding actions remotely while preserving summaries and removal", () => {
        const actions = buildTaskDirectoryMenuActions(session({
            main: {id: "main", name: "main", permission: "read-write", external: true, boundAt: 1},
            directories: [{id: "docs", name: "docs", permission: "read-only", external: true, boundAt: 2}],
        }), {canBindTaskDirectories: false});

        expect(actions.map((action) => action.action)).toEqual(["summary", "unbind"]);
        expect(actions[0]).toEqual(expect.objectContaining({disabled: true}));
        expect(actions[1]).toEqual(expect.objectContaining({directoryID: "docs"}));
        expect(actions.some((action) => action.action === "bind-main" || action.action === "add")).toBe(false);
    });

    it("shows no directory action remotely before a session has a binding", () => {
        expect(buildTaskDirectoryMenuActions(session(), {canBindTaskDirectories: false})).toEqual([]);
    });
});
