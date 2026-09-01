import {describe, it, expect} from "vitest";
import {Constants} from "../../constants";

describe("mobile changelog gaps constants", () => {
    it("has updated longpress and vibration constants (18347)", () => {
        expect(Constants.TIMEOUT_LONGPRESS).toBe(460);
        expect(Constants.TIMEOUT_VIBRATION_DURATION).toBe(20);
    });
});

describe("mobile bottom-click focus helper", () => {
    it("callMobileAppShowKeyboard exists", async () => {
        const mod = await import("../keyboard/mobileAppUtil");
        expect(typeof mod.callMobileAppShowKeyboard).toBe("function");
        expect(typeof mod.armKeyboardLock).toBe("function");
    });
});

describe("record media error", () => {
    it("RecordMediaInputEndedError is exported", async () => {
        const mod = await import("../../protyle/util/RecordMedia");
        expect(mod.RecordMediaInputEndedError).toBeDefined();
        const err = new mod.RecordMediaInputEndedError();
        expect(err.name).toBe("RecordMediaInputEndedError");
    });
});
