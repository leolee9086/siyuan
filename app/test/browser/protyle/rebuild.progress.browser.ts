import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {progressLoading} from "../../../src/dialog/progressLoading";

const previousSiyuan = Reflect.get(globalThis, "siyuan");

beforeEach(() => {
    document.body.innerHTML = "";
    Reflect.set(globalThis, "siyuan", {zIndex: 100});
});

afterEach(() => {
    document.body.innerHTML = "";
    Reflect.set(globalThis, "siyuan", previousSiyuan);
});

describe("rebuild index progress lifecycle", () => {
    it("does not create a progress element for an idempotent end message", () => {
        progressLoading({code: 2, msg: "", data: {}});

        expect(document.getElementById("progress")).toBeNull();
    });

    it("removes an existing progress element on end", () => {
        progressLoading({code: 1, msg: "正在重建索引", data: {}});
        expect(document.getElementById("progress")).not.toBeNull();

        progressLoading({code: 2, msg: "", data: {}});

        expect(document.getElementById("progress")).toBeNull();
    });
});
