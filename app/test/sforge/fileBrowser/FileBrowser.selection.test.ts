import {describe, expect, it} from "vitest";
import {createFileBrowserSelectionStore} from "../../../src/sforge/fileBrowser/FileBrowser.selection";
import {createFileBrowserEntryNode, createFileBrowserRootNode} from "../../../src/sforge/fileBrowser/FileBrowser.tree";
import type {FileBrowserEntry, FileBrowserRoot} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const workspace: FileBrowserRoot = {
    id: "workspace", kind: "workspace", label: "workspace", path: "D:\\workspace",
    permission: "read-write", capabilities: {browse: true, write: true, command: false}, exists: true,
};

const agent: FileBrowserRoot = {
    id: "root-agent", kind: "agent-task-directory", label: "agent", path: "D:\\agent",
    permission: "read-only", capabilities: {browse: true, write: false, command: false}, exists: true,
};

function entry(name: string): FileBrowserEntry {
    return {
        name, path: name, isDir: false, isSymlink: false, restricted: false,
        hidden: false, size: 1, updated: 1, extension: ".txt",
    };
}

describe("shared file browser selection", () => {
    it("supports replacement, toggle and visible-order range selection", () => {
        const selection = createFileBrowserSelectionStore();
        const root = createFileBrowserRootNode(workspace);
        const first = createFileBrowserEntryNode(root, entry("first.txt"));
        const second = createFileBrowserEntryNode(root, entry("second.txt"));
        const third = createFileBrowserEntryNode(root, entry("third.txt"));
        const visible = [root, first, second, third];

        selection.select(first, visible);
        selection.select(third, visible, {toggle: true, range: false});
        expect(selection.keys.value).toEqual([first.key, third.key]);
        expect(selection.primaryKey.value).toBe(third.key);

        selection.select(second, visible, {toggle: false, range: true});
        expect(selection.keys.value).toEqual([second.key, third.key]);
        expect(selection.primaryKey.value).toBe(second.key);

        selection.select(third, visible, {toggle: true, range: false});
        expect(selection.keys.value).toEqual([second.key]);
        expect(selection.primaryKey.value).toBe(second.key);
    });

    it("retains selection across consumers and removes only revoked roots", () => {
        const selection = createFileBrowserSelectionStore();
        const workspaceNode = createFileBrowserRootNode(workspace);
        const agentNode = createFileBrowserRootNode(agent);
        selection.select(workspaceNode, [workspaceNode, agentNode]);
        selection.select(agentNode, [workspaceNode, agentNode], {toggle: true, range: false});
        const revision = selection.revision.value;

        selection.retainRoots(new Set(["workspace", "root-agent"]));
        expect(selection.revision.value).toBe(revision);
        expect(selection.keys.value).toEqual([workspaceNode.key, agentNode.key]);

        selection.retainRoots(new Set(["workspace"]));
        expect(selection.keys.value).toEqual([workspaceNode.key]);
        expect(selection.primaryKey.value).toBe(workspaceNode.key);
    });
});
