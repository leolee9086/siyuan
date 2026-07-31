import {describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    setPadding: vi.fn(),
}));

vi.mock("../../src/protyle/ui/padding", () => ({
    setPadding: runtime.setPadding,
}));

import {Editor} from "../../src/editor/model/Editor";

describe("Editor lifecycle", () => {
    it("destroys the bottom backlink panel before the Protyle engine", () => {
        const backlinkElement = document.createElement("div");
        document.body.appendChild(backlinkElement);
        const backlinkDestroy = vi.fn();
        const editorDestroy = vi.fn();
        const instance = Object.create(Editor.prototype) as Editor & {
            backlinkElement: HTMLElement;
            backlinkIntersectionObserver: {disconnect: () => void};
            backlinkMutationObserver: {disconnect: () => void};
            backlink: {destroy: () => void};
        };
        const intersectionDisconnect = vi.fn();
        const mutationDisconnect = vi.fn();
        instance.backlinkElement = backlinkElement;
        instance.backlinkIntersectionObserver = {disconnect: intersectionDisconnect};
        instance.backlinkMutationObserver = {disconnect: mutationDisconnect};
        instance.backlink = {destroy: backlinkDestroy};
        instance.editor = {
            destroy: editorDestroy,
            protyle: {},
        } as Editor["editor"];

        instance.destroy();

        expect(intersectionDisconnect).toHaveBeenCalledOnce();
        expect(mutationDisconnect).toHaveBeenCalledOnce();
        expect(backlinkDestroy).toHaveBeenCalledOnce();
        expect(editorDestroy).toHaveBeenCalledOnce();
        expect(backlinkElement.isConnected).toBe(false);
        expect(runtime.setPadding).toHaveBeenCalledOnce();
    });
});
