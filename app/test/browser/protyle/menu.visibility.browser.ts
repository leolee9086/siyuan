import {afterEach, describe, expect, it} from "vitest";
import {
    createProtyleMenuContext,
    filterProtyleMenuItems,
} from "../../../src/protyle/runtime/menu.visibility";

const previousSiyuan = Reflect.get(globalThis, "siyuan");
const protyle = {app: {plugins: []}} as unknown as IProtyle;

afterEach(() => {
    Reflect.set(globalThis, "siyuan", previousSiyuan);
});

describe("Protyle menu visibility", () => {
    it("keeps core editing actions and hides full-app actions in standalone mode", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: true});
        const context = createProtyleMenuContext({protyle, nodeType: "NodeParagraph"});
        const items = filterProtyleMenuItems([
            {id: "cut"},
            {id: "move", protyle: {standalone: false}},
            {id: "separator", type: "separator"},
            {id: "delete"},
        ], context);

        expect(items.map(item => item.id)).toEqual(["cut", "separator", "delete"]);
    });

    it("supports capability and context predicates for optional menu items", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: true});
        const context = createProtyleMenuContext({protyle, nodeType: "NodeParagraph"});
        const items = filterProtyleMenuItems([
            {id: "kernel", protyle: {requires: ["kernel"]}},
            {id: "paragraph", protyle: {when: current => current.nodeType === "NodeParagraph"}},
            {id: "heading", protyle: {when: current => current.nodeType === "NodeHeading"}},
            {
                id: "nested",
                type: "submenu",
                submenu: [{id: "nested-hidden", protyle: {standalone: false}}],
            },
        ], context);

        expect(items.map(item => item.id)).toEqual(["kernel", "paragraph"]);
    });

    it("shows standalone-disabled items in the full app host", () => {
        Reflect.set(globalThis, "siyuan", {standaloneProtyle: false});
        const context = createProtyleMenuContext({protyle});
        const items = filterProtyleMenuItems([
            {id: "move", protyle: {standalone: false}},
        ], context);

        expect(items.map(item => item.id)).toEqual(["move"]);
    });
});
