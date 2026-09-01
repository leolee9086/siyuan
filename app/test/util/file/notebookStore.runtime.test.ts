import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    notebooks: [] as INotebook[],
    config: {fileTree: {boxDocEnabled: false}},
    fetchPost: vi.fn(),
    setNotebooks: vi.fn(),
}));

vi.mock("../../../src/util/file/notebook/imports", () => ({
    fetchPost: runtime.fetchPost,
    getSiyuanConfig: () => runtime.config,
    getSiyuanNotebooks: () => runtime.notebooks,
    setSiyuanNotebooks: runtime.setNotebooks,
}));

import {
    isEncryptedBox,
    setNoteBook,
    withEncryptedNotebook,
} from "../../../src/util/file/notebook/store";

beforeEach(() => {
    runtime.notebooks = [
        {id: "plain-box", name: "Plain", closed: false, encrypted: false},
        {id: "encrypted-box", name: "Encrypted", closed: false, encrypted: true},
    ] as INotebook[];
    runtime.config.fileTree.boxDocEnabled = false;
    runtime.fetchPost.mockReset();
    runtime.setNotebooks.mockReset();
});

describe("notebook request context", () => {
    it("finds encryption state by notebook identity", () => {
        expect(isEncryptedBox("encrypted-box")).toBe(true);
        expect(isEncryptedBox("plain-box")).toBe(false);
        expect(isEncryptedBox("missing-box")).toBe(false);
        expect(isEncryptedBox("")).toBe(false);
    });

    it("adds notebook context only for the matching encrypted notebook", () => {
        const params = {id: "block-id"};

        expect(withEncryptedNotebook("plain-box", params)).toBe(params);
        expect(withEncryptedNotebook("encrypted-box", params)).toEqual({
            id: "block-id",
            notebook: "encrypted-box",
        });
        expect(withEncryptedNotebook("encrypted-box", params)).not.toBe(params);
    });

    it("returns the request promise so application startup can await the initial refresh", () => {
        const request = Promise.resolve();
        runtime.fetchPost.mockReturnValueOnce(request);

        expect(setNoteBook()).toBe(request);
    });

    it("applies notebooks and top-level document mode from an ordinary refresh", () => {
        const refreshed = [{id: "refreshed-box", name: "Refreshed", closed: false}] as INotebook[];
        setNoteBook();
        const callback = runtime.fetchPost.mock.calls[0]?.[2] as ((response: IWebSocketData) => void) | undefined;
        expect(callback).toBeTypeOf("function");
        callback?.(Object.assign({} as IWebSocketData, {
            data: {notebooks: refreshed, boxDocEnabled: true},
        }));

        expect(runtime.setNotebooks).toHaveBeenCalledWith(refreshed);
        expect(runtime.config.fileTree.boxDocEnabled).toBe(true);
    });

    it("keeps flashcard notebook results isolated from workspace state", () => {
        const flashcardNotebooks = [{id: "cards", name: "Cards", closed: false}] as INotebook[];
        const consumer = vi.fn();
        setNoteBook(consumer, true);
        const callback = runtime.fetchPost.mock.calls[0]?.[2] as ((response: IWebSocketData) => void) | undefined;
        expect(callback).toBeTypeOf("function");
        callback?.(Object.assign({} as IWebSocketData, {
            data: {notebooks: flashcardNotebooks, boxDocEnabled: true},
        }));

        expect(consumer).toHaveBeenCalledWith(flashcardNotebooks);
        expect(runtime.setNotebooks).not.toHaveBeenCalled();
        expect(runtime.config.fileTree.boxDocEnabled).toBe(false);
    });
});
