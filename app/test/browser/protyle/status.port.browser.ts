import {describe, expect, it} from "vitest";
import {resolveStatusElement} from "../../../src/layout/statusPort";

describe("status host capability", () => {
    it("accepts an element, an id, and an omitted capability", () => {
        const status = document.createElement("div");
        status.id = "host-status";
        document.body.append(status);

        expect(resolveStatusElement(status)).toBe(status);
        expect(resolveStatusElement("host-status")).toBe(status);
        expect(resolveStatusElement()).toBeUndefined();
        status.remove();
    });
});
