import {beforeEach, describe, expect, it, vi} from "vitest";
import {
    beginComposerHistoryBrowsing,
    createComposerHistory,
    isBrowsingComposerHistory,
    navigateComposerHistoryDown,
    navigateComposerHistoryUp,
    pushComposerHistory,
} from "../../../../src/layout/dock/agent/composer/AgentComposer.history";

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

        const handle = mountComposer({host, onSend, onChange});

        expect(handle).toEqual({runtime: "tiptap"});
        expect(mocks.mountTiptapComposer).toHaveBeenCalledWith(host, onSend, onChange);
        expect(mocks.mountProtyleComposer).not.toHaveBeenCalled();
    });

    it("uses Protyle only when the host explicitly provides App", () => {
        const host = {} as HTMLElement;
        const app = {appId: "full-app"};
        const onSend = vi.fn();

        const handle = mountComposer({host, onSend, app: app as never});

        expect(handle).toEqual({runtime: "protyle"});
        expect(mocks.mountProtyleComposer).toHaveBeenCalledWith(app, host, onSend, undefined);
        expect(mocks.mountTiptapComposer).not.toHaveBeenCalled();
    });
});

describe("ComposerHistory", () => {
    it("navigates sent messages and restores the unsent draft", () => {
        const history = createComposerHistory();
        pushComposerHistory(history, "first");
        pushComposerHistory(history, "second");

        expect(beginComposerHistoryBrowsing(history, "draft")).toBe("second");
        expect(navigateComposerHistoryUp(history)).toBe("first");
        expect(navigateComposerHistoryDown(history)).toBe("second");
        expect(navigateComposerHistoryDown(history)).toBe("draft");
        expect(isBrowsingComposerHistory(history)).toBe(false);
    });

    it("deduplicates adjacent entries and retains the latest fifty", () => {
        const history = createComposerHistory();
        pushComposerHistory(history, "same");
        pushComposerHistory(history, "same");
        for (let index = 0; index < 55; index++) {
            pushComposerHistory(history, `message-${index}`);
        }

        expect(history.items).toHaveLength(50);
        expect(history.items[0]).toBe("message-5");
        expect(history.items[49]).toBe("message-54");
    });
});
