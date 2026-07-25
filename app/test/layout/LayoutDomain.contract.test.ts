import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {Wnd} from "../../src/layout/Wnd";
import type {Tab} from "../../src/layout/Tab";
import type {Outline} from "../../src/layout/dock/outline/Outline";
import type {Dock} from "../../src/layout/dock";
import type {Layout} from "../../src/layout";
import type {DockDomain} from "../../src/layout/dock/dock.types";
import type {LayoutDomain, LayoutTab, LayoutWindow} from "../../src/layout/layout.types";
import type {OutlineDomain} from "../../src/layout/dock/outline/types";
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
import type {Model} from "../../src/layout/Model";
import type {ModelDomain} from "../../src/layout/lifecycle/model.types";
import type {Backlink} from "../../src/layout/dock/Backlink";
import type {BacklinkDomain} from "../../src/layout/dock/backlink/backlink.types";
import type {Forwardlink} from "../../src/layout/dock/forwardlink/Forwardlink";
import type {ForwardlinkDomain} from "../../src/layout/dock/forwardlink/Forwardlink.types";
import type {Files} from "../../src/layout/dock/Files";
import type {FilesDomain} from "../../src/layout/dock/Files/eventHandlers.types";

type WndContract = PublicInstanceLooksLike<typeof Wnd, LayoutWindow>;
type TabContract = PublicInstanceLooksLike<typeof Tab, LayoutTab>;
type OutlineContract = PublicInstanceLooksLike<typeof Outline, OutlineDomain<AppFacade, Tab>>;
type DockContract = PublicInstanceLooksLike<typeof Dock, DockDomain>;
type LayoutContract = PublicInstanceLooksLike<typeof Layout, LayoutDomain>;
type GraphContract = PublicInstanceLooksLike<typeof Graph, GraphDomain<AppFacade, Tab>>;
type CustomListsContract = PublicInstanceLooksLike<
    typeof CustomLists,
    CustomListsDomain
>;
type TreeContract = PublicInstanceLooksLike<typeof Tree, TreeDomain>;
type ProtyleContract = PublicInstanceLooksLike<typeof Protyle, ProtyleDomain>;
type ModelContract = PublicInstanceLooksLike<typeof Model, ModelDomain>;
type BacklinkContract = PublicInstanceLooksLike<typeof Backlink, BacklinkDomain<AppFacade, Tab>>;
type ForwardlinkContract = PublicInstanceLooksLike<typeof Forwardlink, ForwardlinkDomain<AppFacade, Tab>>;
type FilesContract = PublicInstanceLooksLike<typeof Files, FilesDomain<AppFacade, Tab>>;

const wndContract: WndContract = true;
const tabContract: TabContract = true;
const outlineContract: OutlineContract = true;
const dockContract: DockContract = true;
const layoutContract: LayoutContract = true;
const graphContract: GraphContract = true;
const customListsContract: CustomListsContract = true;
const treeContract: TreeContract = true;
const protyleContract: ProtyleContract = true;
const modelContract: ModelContract = true;
const backlinkContract: BacklinkContract = true;
const forwardlinkContract: ForwardlinkContract = true;
const filesContract: FilesContract = true;

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
        assert.equal(modelContract, true);
        assert.equal(backlinkContract, true);
        assert.equal(forwardlinkContract, true);
        assert.equal(filesContract, true);
    });
});
