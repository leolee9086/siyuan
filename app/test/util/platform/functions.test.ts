import {afterEach, describe, expect, it, vi} from "vitest";

import {getEventName, isIPad, isIPhone} from "../../../src/util/platform/functions";

afterEach(() => {
    vi.restoreAllMocks();
});

/** 用途：验证移动平台判断与历史点击事件选择语义。 */
describe("mobile platform functions", () => {
    it("uses touchstart only for iPhone", () => {
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)");

        expect(isIPhone()).toBe(true);
        expect(isIPad()).toBe(false);
        expect(getEventName()).toBe("touchstart");
    });

    it("keeps click for iPad", () => {
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPad; CPU OS 18_0)");

        expect(isIPhone()).toBe(false);
        expect(isIPad()).toBe(true);
        expect(getEventName()).toBe("click");
    });

    it("keeps click for desktop browsers", () => {
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

        expect(isIPhone()).toBe(false);
        expect(isIPad()).toBe(false);
        expect(getEventName()).toBe("click");
    });
});
