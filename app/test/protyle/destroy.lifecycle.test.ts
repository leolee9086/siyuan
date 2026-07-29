import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../src/protyle/ui/hideElements", () => ({
    hideElements: vi.fn(),
}));

vi.mock("../../src/protyle/render/searchMarkRender", () => ({
    isSupportCSSHL: () => false,
}));

import {destroy} from "../../src/protyle/util/destroy";

const createProtyle = (ws?: {send: (command: string, payload: object) => void}) => ({
    app: {plugins: []},
    element: document.createElement("div"),
    ws,
}) as IProtyle;

describe("Protyle destroy lifecycle", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("destroys a static Protyle without a WebSocket", () => {
        expect(() => destroy(createProtyle())).not.toThrow();
    });

    it("closes an existing WebSocket immediately", () => {
        const send = vi.fn();

        destroy(createProtyle({send}));

        expect(send).toHaveBeenCalledOnce();
        expect(send).toHaveBeenCalledWith("closews", {});
        expect(vi.getTimerCount()).toBe(0);
    });

    it("retries an existing WebSocket after the original delay", () => {
        const send = vi.fn()
            .mockImplementationOnce(() => {
                throw new Error("socket is not ready");
            })
            .mockImplementationOnce(() => undefined);

        destroy(createProtyle({send}));

        expect(send).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(10240);
        expect(send).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenLastCalledWith("closews", {});
    });
});
