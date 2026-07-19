import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

import {Model} from "../../src/layout/Model";
import {disposeModelResources} from "../../src/layout/lifecycle/model";
import type {ILayoutModel} from "../../src/layout/lifecycle/model.types";

function createSocket(readyState: number) {
    return {
        readyState,
        send: vi.fn(),
        close: vi.fn(),
        onopen: vi.fn(),
        onmessage: vi.fn(),
        onclose: vi.fn(),
        onerror: vi.fn(),
    };
}

describe("Model WebSocket lifecycle", () => {
    beforeEach(() => {
        vi.stubGlobal("WebSocket", {
            CONNECTING: 0,
            OPEN: 1,
            CLOSING: 2,
            CLOSED: 3,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("does not send while the socket is still connecting", () => {
        const model = new Model({app: {} as never});
        const socket = createSocket(WebSocket.CONNECTING);
        model.ws = socket as unknown as WebSocket;

        expect(() => model.send("closews", {})).not.toThrow();
        expect(socket.send).not.toHaveBeenCalled();
    });

    it("sends closews before disposing an open socket", () => {
        const model = new Model({app: {} as never});
        const socket = createSocket(WebSocket.OPEN);
        model.ws = socket as unknown as WebSocket;

        model.dispose();

        expect(socket.send).toHaveBeenCalledOnce();
        expect(JSON.parse(socket.send.mock.calls[0][0])).toMatchObject({cmd: "closews"});
        expect(socket.close).toHaveBeenCalledOnce();
        expect(socket.onopen).toBeNull();
        expect(socket.onmessage).toBeNull();
        expect(socket.onclose).toBeNull();
        expect(socket.onerror).toBeNull();
    });

    it("closes a connecting socket without attempting closews", () => {
        const model = new Model({app: {} as never});
        const socket = createSocket(WebSocket.CONNECTING);
        model.ws = socket as unknown as WebSocket;

        model.dispose();

        expect(socket.send).not.toHaveBeenCalled();
        expect(socket.close).toHaveBeenCalledOnce();
    });

    it("runs an Agent-like destroy hook before disposing its base connection", () => {
        const order: string[] = [];
        const model = {
            layoutModel: true,
            destroy: vi.fn(() => order.push("destroy")),
            dispose: vi.fn(() => order.push("dispose")),
        } satisfies ILayoutModel;

        disposeModelResources(model);

        expect(order).toEqual(["destroy", "dispose"]);
    });

    it("still disposes the connection when a model destroy hook fails", () => {
        const dispose = vi.fn();
        const model = {
            layoutModel: true,
            destroy: vi.fn(() => {
                throw new Error("destroy failed");
            }),
            dispose,
        } satisfies ILayoutModel;

        expect(() => disposeModelResources(model)).toThrow("destroy failed");
        expect(dispose).toHaveBeenCalledOnce();
    });

    it("accepts a layout model without resource lifecycle capabilities", () => {
        const model = {layoutModel: true} satisfies ILayoutModel;

        expect(() => disposeModelResources(model)).not.toThrow();
    });
});
