import {beforeEach, describe, expect, it, vi} from "vitest";
import {ComposerHistory} from "../../../../src/layout/dock/agent/AgentComposer.history";

const mocks = vi.hoisted(() => ({
    mountTiptapComposer: vi.fn(() => ({runtime: "tiptap"})),
    mountProtyleComposer: vi.fn(() => ({runtime: "protyle"})),
}));

vi.mock("../../../../src/layout/dock/agent/AgentComposer.tiptap", () => ({
    mountTiptapComposer: mocks.mountTiptapComposer,
}));

vi.mock("../../../../src/layout/dock/agent/AgentComposer.protyle", () => ({
    mountProtyleComposer: mocks.mountProtyleComposer,
}));

import {mountComposer} from "../../../../src/layout/dock/agent/AgentComposer";

describe("Agent Composer runtime selection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses Tiptap when the host does not provide a full App runtime", () => {
        const host = {} as HTMLElement;
        const onSend = vi.fn();
        const onChange = vi.fn();

        const handle = mountComposer(host, onSend, onChange);

        expect(handle).toEqual({runtime: "tiptap"});
        expect(mocks.mountTiptapComposer).toHaveBeenCalledWith(host, onSend, onChange);
        expect(mocks.mountProtyleComposer).not.toHaveBeenCalled();
    });

    it("uses Protyle only when the host explicitly provides App", () => {
        const host = {} as HTMLElement;
        const app = {appId: "full-app"};
        const onSend = vi.fn();

        const handle = mountComposer(host, onSend, undefined, app as never);

        expect(handle).toEqual({runtime: "protyle"});
        expect(mocks.mountProtyleComposer).toHaveBeenCalledWith(app, host, onSend, undefined);
        expect(mocks.mountTiptapComposer).not.toHaveBeenCalled();
    });
});

describe("ComposerHistory", () => {
    it("navigates sent messages and restores the unsent draft", () => {
        const history = new ComposerHistory();
        history.push("first");
        history.push("second");

        expect(history.beginBrowsing("draft")).toBe("second");
        expect(history.navigateUp()).toBe("first");
        expect(history.navigateDown()).toBe("second");
        expect(history.navigateDown()).toBe("draft");
        expect(history.isBrowsing()).toBe(false);
    });

    it("deduplicates adjacent entries and retains the latest fifty", () => {
        const history = new ComposerHistory();
        history.push("same");
        history.push("same");
        for (let index = 0; index < 55; index++) {
            history.push(`message-${index}`);
        }

        expect(history.get()).toHaveLength(50);
        expect(history.get()[0]).toBe("message-5");
        expect(history.get()[49]).toBe("message-54");
    });
});
