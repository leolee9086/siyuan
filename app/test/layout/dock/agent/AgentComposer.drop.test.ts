import {describe, expect, it, vi} from "vitest";
import {Constants} from "../../../../src/constants";
import {
    bindAgentComposerBlockDrop,
    getDroppedAgentBlockIds,
    hasAgentBlockReferenceTransfer,
} from "../../../../src/layout/dock/agent/AgentComposer.drop";

const createTransfer = (types: string[], values: Record<string, string> = {}): DataTransfer => {
    const transfer = new DataTransfer();
    for (const type of types) {
        transfer.setData(type, values[type] ?? "");
    }
    transfer.dropEffect = "none";
    return transfer;
};

const createDropEvent = (transfer: DataTransfer): DragEvent => {
    const event = new DragEvent("drop", {cancelable: true});
    Object.defineProperty(event, "dataTransfer", {value: transfer});
    return event;
};

describe("Agent Composer block drop", () => {
    it("recognizes and decodes gutter and file-tree transfers deterministically", () => {
        const gutterType = `${Constants.SIYUAN_DROP_GUTTER}type${Constants.ZWSP}subtype${Constants.ZWSP}block-a,block-b,block-a`;
        const gutterTransfer = createTransfer([gutterType]);
        const fileTransfer = createTransfer(
            [Constants.SIYUAN_DROP_FILE],
            {[Constants.SIYUAN_DROP_FILE]: "doc-a, doc-b,doc-a"},
        );

        expect(hasAgentBlockReferenceTransfer(gutterTransfer)).toBe(true);
        expect(getDroppedAgentBlockIds(gutterTransfer)).toEqual(["block-a", "block-b"]);
        expect(getDroppedAgentBlockIds(fileTransfer)).toEqual(["doc-a", "doc-b"]);
        expect(hasAgentBlockReferenceTransfer(createTransfer(["text/plain"]))).toBe(false);
    });

    it("resolves every label before inserting ordered mentions", async () => {
        const host = document.createElement("div");
        const insertMentions = vi.fn();
        const reportError = vi.fn();
        const resolveLabel = vi.fn(async (id: string) => `label:${id}`);
        bindAgentComposerBlockDrop({host, resolveLabel, insertMentions, reportError});
        const transfer = createTransfer(
            [Constants.SIYUAN_DROP_FILE],
            {[Constants.SIYUAN_DROP_FILE]: "doc-a,doc-b"},
        );
        const event = createDropEvent(transfer);

        host.dispatchEvent(event);
        await vi.waitFor(() => expect(insertMentions).toHaveBeenCalledOnce());

        expect(event.defaultPrevented).toBe(true);
        expect(resolveLabel).toHaveBeenCalledTimes(2);
        expect(insertMentions).toHaveBeenCalledWith([
            {id: "doc-a", label: "label:doc-a"},
            {id: "doc-b", label: "label:doc-b"},
        ]);
        expect(reportError).not.toHaveBeenCalled();
    });

    it("reports label resolution errors and inserts no partial result", async () => {
        const host = document.createElement("div");
        const insertMentions = vi.fn();
        const error = new Error("reference lookup failed");
        const reportError = vi.fn();
        bindAgentComposerBlockDrop({
            host,
            resolveLabel: async () => {
                throw error;
            },
            insertMentions,
            reportError,
        });
        const transfer = createTransfer(
            [Constants.SIYUAN_DROP_FILE],
            {[Constants.SIYUAN_DROP_FILE]: "doc-a"},
        );

        host.dispatchEvent(createDropEvent(transfer));
        await vi.waitFor(() => expect(reportError).toHaveBeenCalledOnce());

        expect(reportError).toHaveBeenCalledWith(error);
        expect(insertMentions).not.toHaveBeenCalled();
    });
});
