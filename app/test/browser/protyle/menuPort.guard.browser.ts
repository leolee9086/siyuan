import {describe, expect, it, vi} from "vitest";
import {parseProtyleMenuPort} from "../../../src/protyle/runtime/menu.guard";

const createMenuHost = () => ({
    element: document.createElement("div"),
    append: vi.fn(),
    remove: vi.fn(),
    popup: vi.fn(),
    fullscreen: vi.fn(),
    showSubMenu: vi.fn(),
});

describe("parseProtyleMenuPort", () => {
    it("keeps the original host identity after validation", () => {
        const host = createMenuHost();

        expect(parseProtyleMenuPort(host)).toBe(host);
    });

    it("reports the missing capability path before Protyle uses the host", () => {
        const host = createMenuHost();
        Reflect.deleteProperty(host, "popup");

        expect(() => parseProtyleMenuPort(host)).toThrow(/popup/);
    });
});
