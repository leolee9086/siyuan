import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {Wnd} from "../../src/layout/Wnd";
import type {Tab} from "../../src/layout/Tab";
import type {Outline} from "../../src/layout/dock/outline/Outline";
import type {LayoutTab, LayoutWindow} from "../../src/layout/layout.types";
import type {IOutlinePanel} from "../../src/layout/dock/outline/types";
import type {IsAssignable} from "../../src/util/types/LooksLike.types";

type WndContract = IsAssignable<Wnd, LayoutWindow>;
type TabContract = IsAssignable<Tab, LayoutTab>;
type OutlineContract = IsAssignable<Outline, IOutlinePanel>;

const wndContract: WndContract = true;
const tabContract: TabContract = true;
const outlineContract: OutlineContract = true;

describe("layout domain contracts", () => {
    it("keeps concrete window, tab, and outline classes compatible with their abstract roots", () => {
        assert.equal(wndContract, true);
        assert.equal(tabContract, true);
        assert.equal(outlineContract, true);
    });
});
