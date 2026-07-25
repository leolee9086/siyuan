import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {Wnd} from "../../src/layout/Wnd";
import type {Tab} from "../../src/layout/Tab";
import type {Outline} from "../../src/layout/dock/outline/Outline";
import type {Dock} from "../../src/layout/dock";
import type {Layout} from "../../src/layout";
import type {DockDomain} from "../../src/layout/dock/dock.types";
import type {LayoutDomain, LayoutTab, LayoutWindow} from "../../src/layout/layout.types";
import type {IOutlinePanel} from "../../src/layout/dock/outline/types";
import type {IsAssignable} from "../../src/util/types/LooksLike.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";
import type {Graph} from "../../src/layout/dock/Graph";
import type {GraphDomain} from "../../src/layout/dock/graph/graph.types";
import type {AppFacade} from "../../src/app/AppFacade.types";
import type {CustomLists} from "../../src/layout/dock/customBlockLists/CustomLists";
import type {CustomListsDomain} from "../../src/layout/dock/customBlockLists/customLists.types";
import type {Tree} from "../../src/util/file/Tree";
import type {Protyle} from "../../src/protyle";
import type {TreeDomain} from "../../src/util/file/tree.types";
import type {ProtyleDomain} from "../../src/protyle/protyle.types";

type WndContract = PublicInstanceLooksLike<typeof Wnd, LayoutWindow>;
type TabContract = PublicInstanceLooksLike<typeof Tab, LayoutTab>;
type OutlineContract = IsAssignable<Outline, IOutlinePanel>;
type DockContract = PublicInstanceLooksLike<typeof Dock, DockDomain>;
type LayoutContract = PublicInstanceLooksLike<typeof Layout, LayoutDomain>;
type GraphContract = PublicInstanceLooksLike<typeof Graph, GraphDomain<AppFacade, Tab>>;
type CustomListsContract = PublicInstanceLooksLike<
    typeof CustomLists,
    CustomListsDomain
>;
type TreeContract = PublicInstanceLooksLike<typeof Tree, TreeDomain>;
type ProtyleContract = PublicInstanceLooksLike<typeof Protyle, ProtyleDomain>;

const wndContract: WndContract = true;
const tabContract: TabContract = true;
const outlineContract: OutlineContract = true;
const dockContract: DockContract = true;
const layoutContract: LayoutContract = true;
const graphContract: GraphContract = true;
const customListsContract: CustomListsContract = true;
const treeContract: TreeContract = true;
const protyleContract: ProtyleContract = true;

describe("layout domain contracts", () => {
    it("keeps concrete window, tab, and outline classes compatible with their abstract roots", () => {
        assert.equal(wndContract, true);
        assert.equal(tabContract, true);
        assert.equal(outlineContract, true);
        assert.equal(dockContract, true);
        assert.equal(layoutContract, true);
        assert.equal(graphContract, true);
        assert.equal(customListsContract, true);
        assert.equal(treeContract, true);
        assert.equal(protyleContract, true);
    });
});
