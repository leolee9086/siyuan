import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/constants", () => ({
    Constants: {SIYUAN_APPID: "test-app"},
}));

vi.mock("../../src/platform", () => ({
    isElectron: true,
}));

const runtime = vi.hoisted(() => ({
    createModelWebSocket: vi.fn(),
    kernelError: vi.fn(),
    processMessage: vi.fn(),
    reloadSync: vi.fn(),
}));

vi.mock("../../src/layout/modelRegistry", () => ({
    getModelHandlers: () => ({
        kernelError: runtime.kernelError,
        processMessage: runtime.processMessage,
        reloadSync: runtime.reloadSync,
    }),
}));

vi.mock("../../src/layout/modelWebSocket.factory", () => ({
    createModelWebSocket: (url: string) => runtime.createModelWebSocket(url),
}));

import {Model} from "../../src/layout/Model";
import {disposeModelResources} from "../../src/layout/lifecycle/model";
import {
    beginForgeRuntimeElectronRestart,
    getForgeRuntimeElectronRestartState,
    isForgeRuntimeElectronRestartActive,
} from "../../src/sforge/forgeRuntime/restartState";
import type {
    ILayoutDestroyableModel,
    ILayoutDisposableModel,
    ILayoutModel,
} from "../../src/layout/lifecycle/model.types";

function createSocket(readyState: number, url = "ws://localhost/ws?type=main") {
    const send = vi.fn<(data: string) => void>();
    const close = vi.fn<(code?: number, reason?: string) => void>();
    const socket: WebSocket = Object.assign({} as WebSocket, {
        url,
        readyState,
        send,
        close,
        onopen: null,
        onmessage: null,
        onclose: null,
        onerror: null,
    });
    return {close, send, socket};
}

function emitOpen(socket: WebSocket) {
    const handler = socket.onopen;
    if (!handler) {
        throw new Error("WebSocket open handler is not registered");
    }
    handler.call(socket, new Event("open"));
}

function emitMessage(socket: WebSocket, data: string) {
    const handler = socket.onmessage;
    if (!handler) {
        throw new Error("WebSocket message handler is not registered");
    }
    handler.call(socket, new MessageEvent("message", {data}));
}

function emitClose(socket: WebSocket, reason = "") {
    const handler = socket.onclose;
    if (!handler) {
        throw new Error("WebSocket close handler is not registered");
    }
    handler.call(socket, new CloseEvent("close", {reason}));
}

function createDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return {promise, reject, resolve};
}

describe("Model WebSocket lifecycle", () => {
    beforeEach(() => {
        runtime.createModelWebSocket.mockReset();
        runtime.kernelError.mockReset();
        runtime.processMessage.mockReset();
        runtime.reloadSync.mockReset();
        vi.stubGlobal("WebSocket", {
            CONNECTING: 0,
            OPEN: 1,
            CLOSING: 2,
            CLOSED: 3,
        });
        vi.stubGlobal("siyuan", {config: {}, dialogs: []});
    });

    afterEach(() => {
        const state = getForgeRuntimeElectronRestartState();
        state.active = false;
        state.context = undefined;
        state.promise = undefined;
        vi.unstubAllGlobals();
    });

    it("represents the constructed model before mount, connect, and first send", () => {
        const model = new Model({app: {} as never});

        expect(model.parent).toBeUndefined();
        expect(model.ws).toBeUndefined();
        expect(model.reqId).toBeUndefined();
    });

    it("does not send while the socket is still connecting", () => {
        const model = new Model({app: {} as never});
        const {send, socket} = createSocket(WebSocket.CONNECTING);
        model.ws = socket;

        expect(() => model.send("closews", {})).not.toThrow();
        expect(send).not.toHaveBeenCalled();
    });

    it("sends closews before disposing an open socket", () => {
        const model = new Model({app: {} as never});
        const {close, send, socket} = createSocket(WebSocket.OPEN);
        model.ws = socket;

        model.dispose();

        expect(send).toHaveBeenCalledOnce();
        const firstCall = send.mock.calls[0];
        expect(firstCall).toBeDefined();
        if (!firstCall) {
            throw new Error("closews payload was not sent");
        }
        expect(JSON.parse(firstCall[0])).toMatchObject({cmd: "closews"});
        expect(close).toHaveBeenCalledOnce();
        expect(socket.onopen).toBeNull();
        expect(socket.onmessage).toBeNull();
        expect(socket.onclose).toBeNull();
        expect(socket.onerror).toBeNull();
        expect(model.ws).toBeUndefined();

        model.dispose();
        expect(send).toHaveBeenCalledOnce();
        expect(close).toHaveBeenCalledOnce();
    });

    it("closes a connecting socket without attempting closews", () => {
        const model = new Model({app: {} as never});
        const {close, send, socket} = createSocket(WebSocket.CONNECTING);
        model.ws = socket;

        model.dispose();

        expect(send).not.toHaveBeenCalled();
        expect(close).toHaveBeenCalledOnce();
    });

    it("processes asynchronous websocket messages in arrival order", async () => {
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const firstResult = createDeferred<IWebSocketData | false>();
        const firstResponse = {cmd: "transactions", code: 0, msg: "", data: {id: "first"}};
        const secondResponse = {cmd: "transactions", code: 0, msg: "", data: {id: "second"}};
        const received: string[] = [];
        runtime.createModelWebSocket.mockReturnValue(socket);
        runtime.processMessage.mockImplementationOnce(() => firstResult.promise);
        runtime.processMessage.mockResolvedValueOnce(secondResponse);
        model.connect({
            id: "ordered",
            msgCallback: (response) => {
                received.push(response.data.id);
            },
        });
        emitMessage(socket, JSON.stringify(firstResponse));
        emitMessage(socket, JSON.stringify(secondResponse));
        await vi.waitFor(() => expect(runtime.processMessage).toHaveBeenCalledOnce());
        expect(received).toEqual([]);

        firstResult.resolve(firstResponse);
        await vi.waitFor(() => expect(received).toEqual(["first", "second"]));
    });

    it("reports one message failure and continues with the next message", async () => {
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const error = new Error("message failed");
        const nextResponse = {cmd: "transactions", code: 0, msg: "", data: {id: "next"}};
        const received: string[] = [];
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
        runtime.createModelWebSocket.mockReturnValue(socket);
        runtime.processMessage.mockRejectedValueOnce(error);
        runtime.processMessage.mockResolvedValueOnce(nextResponse);
        model.connect({
            id: "recover",
            msgCallback: (response) => {
                received.push(response.data.id);
            },
        });
        emitMessage(socket, JSON.stringify({cmd: "transactions", code: 0, msg: "", data: {id: "failed"}}));
        emitMessage(socket, JSON.stringify(nextResponse));

        await vi.waitFor(() => expect(received).toEqual(["next"]));
        expect(errorLog).toHaveBeenCalledWith("Model WebSocket message processing failed", error);
    });

    it("lets a new socket proceed without waiting for the replaced socket", async () => {
        const model = new Model({app: {} as never});
        const {socket: oldSocket} = createSocket(WebSocket.OPEN);
        const {socket: newSocket} = createSocket(WebSocket.OPEN);
        const oldResult = createDeferred<IWebSocketData | false>();
        const oldResponse = {cmd: "transactions", code: 0, msg: "", data: {id: "old"}};
        const newResponse = {cmd: "transactions", code: 0, msg: "", data: {id: "new"}};
        const received: string[] = [];
        runtime.createModelWebSocket.mockReturnValueOnce(oldSocket).mockReturnValueOnce(newSocket);
        runtime.processMessage.mockImplementationOnce(() => oldResult.promise);
        runtime.processMessage.mockResolvedValueOnce(newResponse);
        const connection = {
            id: "replace",
            msgCallback: (response: IWebSocketData) => {
                received.push(response.data.id);
            },
        };
        model.connect(connection);
        emitMessage(oldSocket, JSON.stringify(oldResponse));
        await vi.waitFor(() => expect(runtime.processMessage).toHaveBeenCalledOnce());

        model.connect(connection);
        emitMessage(newSocket, JSON.stringify(newResponse));
        await vi.waitFor(() => expect(received).toEqual(["new"]));

        oldResult.resolve(oldResponse);
        await Promise.resolve();
        expect(received).toEqual(["new"]);
    });

    it("ignores a delayed close event from a replaced socket", async () => {
        vi.useFakeTimers();
        try {
            const model = new Model({app: {} as never});
            const {socket: oldSocket} = createSocket(WebSocket.OPEN);
            const {socket: newSocket} = createSocket(WebSocket.OPEN);
            runtime.createModelWebSocket.mockReturnValueOnce(oldSocket).mockReturnValueOnce(newSocket);
            model.connect({id: "old"});
            const staleCloseHandler = oldSocket.onclose;
            if (!staleCloseHandler) {
                throw new Error("Old WebSocket close handler is not registered");
            }

            model.connect({id: "new"});
            staleCloseHandler.call(oldSocket, new CloseEvent("close", {reason: "network lost"}));
            await vi.advanceTimersByTimeAsync(3000);

            expect(runtime.createModelWebSocket).toHaveBeenCalledTimes(2);
            expect(model.ws).toBe(newSocket);
        } finally {
            vi.useRealTimers();
        }
    });

    it("retains the open callback when reconnecting the current socket", async () => {
        vi.useFakeTimers();
        try {
            const model = new Model({app: {} as never});
            const {socket: firstSocket} = createSocket(WebSocket.OPEN);
            const {socket: secondSocket} = createSocket(WebSocket.OPEN);
            const callback = vi.fn();
            runtime.createModelWebSocket.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket);
            model.connect({id: "reconnect", callback});
            emitOpen(firstSocket);

            emitClose(firstSocket, "network lost");
            await vi.advanceTimersByTimeAsync(3000);
            emitOpen(secondSocket);

            expect(callback).toHaveBeenCalledTimes(2);
            expect(model.ws).toBe(secondSocket);
        } finally {
            vi.useRealTimers();
        }
    });

    it("defers reconnect until Electron Kernel continuity has ended", async () => {
        vi.useFakeTimers();
        try {
            const model = new Model({app: {} as never});
            const {socket: firstSocket} = createSocket(WebSocket.OPEN);
            const {socket: secondSocket} = createSocket(WebSocket.OPEN);
            runtime.createModelWebSocket.mockReturnValueOnce(firstSocket).mockReturnValueOnce(secondSocket);
            model.connect({id: "continuity"});
            beginForgeRuntimeElectronRestart({
                mode: "forge-restart",
                jobId: "restart-job",
                targetRevision: "a".repeat(40),
            });

            emitClose(firstSocket, "kernel replacement");
            await vi.advanceTimersByTimeAsync(3000);
            expect(runtime.createModelWebSocket).toHaveBeenCalledOnce();

            const state = getForgeRuntimeElectronRestartState();
            state.active = false;
            state.context = undefined;
            state.promise = undefined;
            await vi.advanceTimersByTimeAsync(3000);
            expect(runtime.createModelWebSocket).toHaveBeenCalledTimes(2);
        } finally {
            const state = getForgeRuntimeElectronRestartState();
            state.active = false;
            state.context = undefined;
            state.promise = undefined;
            vi.useRealTimers();
        }
    });

    it("registers an Electron exit identity before asynchronous message handling", async () => {
        window.siyuan.isReady = true;
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const exitResponse = {
            cmd: "exit",
            code: 0,
            msg: "",
            data: {
                mode: "forge-restart",
                jobId: "restart-job",
                targetRevision: "a".repeat(40),
            },
        };
        runtime.createModelWebSocket.mockReturnValue(socket);
        runtime.processMessage.mockResolvedValue(exitResponse);
        model.connect({id: "exit", type: "main", msgCallback: vi.fn()});

        emitMessage(socket, JSON.stringify(exitResponse));
        Object.defineProperty(socket, "readyState", {value: WebSocket.CLOSED});
        socket.onerror?.call(socket, new Event("error"));

        expect(isForgeRuntimeElectronRestartActive()).toBe(true);
        expect(runtime.kernelError).not.toHaveBeenCalled();

        await vi.waitFor(() => expect(runtime.processMessage).toHaveBeenCalledOnce());
        model.dispose();
    });

    it("registers an Electron exit identity before config and callback gates", () => {
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const exitResponse = {
            cmd: "exit",
            code: 0,
            msg: "",
            data: {
                mode: "forge-restart",
                jobId: "restart-job-before-config",
                targetRevision: "a".repeat(40),
            },
        };
        runtime.createModelWebSocket.mockReturnValue(socket);
        vi.stubGlobal("siyuan", {dialogs: []});
        model.connect({id: "exit-before-config", type: "main"});

        emitMessage(socket, JSON.stringify(exitResponse));

        expect(isForgeRuntimeElectronRestartActive()).toBe(true);
        model.dispose();
    });

    it("reports an asynchronous open callback failure", async () => {
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const error = new Error("open callback failed");
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
        runtime.createModelWebSocket.mockReturnValue(socket);
        model.connect({
            id: "open-error",
            callback: async () => {
                throw error;
            },
        });

        emitOpen(socket);

        await vi.waitFor(() => {
            expect(errorLog).toHaveBeenCalledWith("Model WebSocket open callback failed", error);
        });
    });

    it("reports malformed frames and continues with the next message", async () => {
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const response = {cmd: "transactions", code: 0, msg: "", data: {id: "valid"}};
        const received: string[] = [];
        const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
        runtime.createModelWebSocket.mockReturnValue(socket);
        runtime.processMessage.mockResolvedValue(response);
        model.connect({
            id: "malformed",
            msgCallback: (message) => {
                received.push(message.data.id);
            },
        });

        emitMessage(socket, "not-json");
        emitMessage(socket, JSON.stringify(response));

        await vi.waitFor(() => expect(received).toEqual(["valid"]));
        expect(errorLog).toHaveBeenCalledWith(
            "Model WebSocket message processing failed",
            expect.any(SyntaxError),
        );
    });

    it("drops a result completed after the model is disposed", async () => {
        const model = new Model({app: {} as never});
        const {socket} = createSocket(WebSocket.OPEN);
        const pendingResult = createDeferred<IWebSocketData | false>();
        const response = {cmd: "transactions", code: 0, msg: "", data: {id: "disposed"}};
        const received: string[] = [];
        runtime.createModelWebSocket.mockReturnValue(socket);
        runtime.processMessage.mockImplementationOnce(() => pendingResult.promise);
        model.connect({
            id: "dispose",
            msgCallback: (message) => {
                received.push(message.data.id);
            },
        });
        emitMessage(socket, JSON.stringify(response));
        await vi.waitFor(() => expect(runtime.processMessage).toHaveBeenCalledOnce());

        model.dispose();
        pendingResult.resolve(response);
        await new Promise<void>((resolve) => setTimeout(resolve, 0));

        expect(received).toEqual([]);
    });

    it("runs an Agent-like destroy hook before disposing its base connection", () => {
        const order: string[] = [];
        const model = {
            layoutModel: true,
            destroy: vi.fn(() => order.push("destroy")),
            dispose: vi.fn(() => order.push("dispose")),
        } satisfies ILayoutDestroyableModel & ILayoutDisposableModel;

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
        } satisfies ILayoutDestroyableModel & ILayoutDisposableModel;

        expect(() => disposeModelResources(model)).toThrow("destroy failed");
        expect(dispose).toHaveBeenCalledOnce();
    });

    it("accepts a layout model without resource lifecycle capabilities", () => {
        const model = {layoutModel: true} satisfies ILayoutModel;

        expect(() => disposeModelResources(model)).not.toThrow();
    });
});
