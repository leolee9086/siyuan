import {afterEach, describe, expect, it} from "vitest";
import {getGutterCoordinateOrigin} from "../../../src/protyle/gutter/setGutterPosition";

const previousSiyuan = Reflect.get(globalThis, "siyuan");

afterEach(() => {
    Reflect.set(globalThis, "siyuan", previousSiyuan);
    document.body.innerHTML = "";
});

describe("standalone gutter positioning", () => {
    it("uses viewport coordinates when no transformed containing block exists", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: true});
        const gutter = document.createElement("div");
        document.body.append(gutter);

        expect(getGutterCoordinateOrigin(gutter)).toEqual({left: 0, top: 0});
    });

    it("converts viewport coordinates for transformed host containers", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: true});
        const host = document.createElement("div");
        host.style.transform = "translate(40px, 30px)";
        host.getBoundingClientRect = () => ({
            top: 30,
            left: 40,
            right: 1040,
            bottom: 830,
            width: 1000,
            height: 800,
            x: 40,
            y: 30,
            toJSON: () => ({}),
        } as DOMRect);
        const gutter = document.createElement("div");
        host.append(gutter);
        document.body.append(host);

        expect(getGutterCoordinateOrigin(gutter)).toEqual({left: 40, top: 30});
    });

    it("keeps the existing app coordinate origin unchanged", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: false});
        const host = document.createElement("div");
        host.style.transform = "translate(40px, 30px)";
        const gutter = document.createElement("div");
        host.append(gutter);
        document.body.append(host);

        expect(getGutterCoordinateOrigin(gutter)).toEqual({left: 0, top: 0});
    });
});

