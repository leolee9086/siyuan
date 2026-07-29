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
import type {
    IsAssignable,
    PublicInstance,
    PublicInstanceLooksLike,
    StrictEqual,
} from "../../src/util/types/LooksLike.types";
import type {Graph} from "../../src/layout/dock/Graph";
import type {GraphDomain} from "../../src/layout/dock/graph/graph.types";
import type {AppFacade} from "../../src/app/AppFacade.types";
import type {CustomLists} from "../../src/layout/dock/customBlockLists/CustomLists";
import type {CustomListsDomain} from "../../src/layout/dock/customBlockLists/customLists.types";
import type {Tree} from "../../src/util/file/tree/Tree";
import type {Tree as SiyuanTree} from "siyuan";
import type {IBlock} from "siyuan";
import type {IBlockTree} from "siyuan";
import type {Protyle} from "../../src/protyle";
import type {TreeDomain, TreeNodeData} from "../../src/util/file/tree.types";
import type {ProtyleDomain} from "../../src/protyle/protyle.types";
import type {Model} from "../../src/layout/Model";
import type {ModelDomain} from "../../src/layout/lifecycle/model.types";
import type {Backlink} from "../../src/layout/dock/Backlink";
import type {BacklinkDomain} from "../../src/layout/dock/backlink/backlink.types";
import type {Forwardlink} from "../../src/layout/dock/forwardlink/Forwardlink";
import type {ForwardlinkDomain} from "../../src/layout/dock/forwardlink/Forwardlink.types";
import type {Files} from "../../src/layout/dock/Files";
import type {FilesDomain} from "../../src/layout/dock/Files/eventHandlers.types";
import type {Asset} from "../../src/asset";
import type {AssetDomain} from "../../src/asset/asset.types";
import {assetModelBrand, isAssetDomain} from "../../src/asset/asset.types";
import {graphModelBrand, isGraphDomain} from "../../src/layout/dock/graph/graph.types";
import {outlineModelBrand, isOutlineDomain} from "../../src/layout/dock/outline/types";
import {backlinkModelBrand, isBacklinkDomain} from "../../src/layout/dock/backlink/backlink.types";
import {filesModelBrand, isFilesDomain} from "../../src/layout/dock/Files/eventHandlers.types";
import {forwardlinkModelBrand, isForwardlinkDomain} from "../../src/layout/dock/forwardlink/Forwardlink.types";
import type {Bookmark} from "../../src/layout/dock/Bookmark";
import type {BookmarkDomain} from "../../src/layout/dock/bookmark/bookmark.types";
import type {Cronjob} from "../../src/layout/dock/Cronjob";
import type {CronjobDomain} from "../../src/layout/dock/cronjob/cronjob.types";
import {bookmarkModelBrand, isBookmarkDomain} from "../../src/layout/dock/bookmark/bookmark.types";
import {cronjobModelBrand, isCronjobDomain} from "../../src/layout/dock/cronjob/cronjob.types";
import type {Custom} from "../../src/layout/dock/custom/Custom";
import type {CustomDomain} from "../../src/layout/dock/custom/custom.types";
import {customModelBrand, isCustomDomain} from "../../src/layout/dock/custom/custom.types";
import type {Tag} from "../../src/layout/dock/Tag";
import type {TagDomain} from "../../src/layout/dock/tag/tag.types";
import {tagModelBrand, isTagDomain} from "../../src/layout/dock/tag/tag.types";
import type {Search} from "../../src/search";
import type {SearchDomain} from "../../src/search/model/search.types";
import {isSearchDomain, searchModelBrand} from "../../src/search/model/search.types";
import type {Editor} from "../../src/editor";
import type {EditorDomain} from "../../src/editor/model/editorDomain.types";
import {editorModelBrand, isEditorDomain} from "../../src/editor/model/editorDomain.types";
import type {MobileBookmarks} from "../../src/mobile/dock/MobileBookmarks";
import type {MobileBookmarksDomain} from "../../src/mobile/dock/bookmark/mobileBookmarks.types";
import type {MobileFiles} from "../../src/mobile/dock/MobileFiles";
import type {MobileFilesDomain} from "../../src/mobile/dock/files/mobileFiles.types";
import {isMobileFilesDomain, mobileFilesModelBrand} from "../../src/mobile/dock/files/mobileFiles.types";

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
type TreePublicSurface = PublicInstance<typeof Tree>;
type TreeKeyContract = StrictEqual<keyof TreePublicSurface, keyof TreeDomain>;
type TreeImplementationContract = IsAssignable<TreePublicSurface, TreeDomain>;
type TreeAbstractionContract = IsAssignable<TreeDomain, TreePublicSurface>;
type TreeUpstreamContract = IsAssignable<TreePublicSurface, PublicInstance<typeof SiyuanTree>>;
type TreeNodeUpstreamContract = IsAssignable<IBlockTree, TreeNodeData>;
type TreeBlockUpstreamContract = IsAssignable<IBlock, NonNullable<TreeNodeData["blocks"]>[number]>;
type ProtyleContract = PublicInstanceLooksLike<typeof Protyle, ProtyleDomain>;
type ModelContract = PublicInstanceLooksLike<typeof Model, ModelDomain>;
type BacklinkContract = PublicInstanceLooksLike<typeof Backlink, BacklinkDomain<AppFacade, LayoutTab>>;
type ForwardlinkContract = PublicInstanceLooksLike<typeof Forwardlink, ForwardlinkDomain<AppFacade, Tab>>;
type FilesContract = PublicInstanceLooksLike<typeof Files, FilesDomain<AppFacade, Tab>>;
type AssetContract = PublicInstanceLooksLike<typeof Asset, AssetDomain<AppFacade, LayoutTab>>;
type BookmarkContract = PublicInstanceLooksLike<typeof Bookmark, BookmarkDomain<AppFacade, LayoutTab>>;
type CronjobContract = PublicInstanceLooksLike<typeof Cronjob, CronjobDomain<AppFacade, LayoutTab>>;
type CustomContract = PublicInstanceLooksLike<
    typeof Custom<unknown>,
    CustomDomain<unknown, AppFacade, LayoutTab>
>;
type TagContract = PublicInstanceLooksLike<typeof Tag, TagDomain<AppFacade, Tab>>;
type SearchContract = PublicInstanceLooksLike<typeof Search, SearchDomain<AppFacade, LayoutTab>>;
type EditorContract = PublicInstanceLooksLike<typeof Editor, EditorDomain<object, ProtyleDomain>>;
type MobileBookmarksContract = PublicInstanceLooksLike<typeof MobileBookmarks, MobileBookmarksDomain>;
type MobileFilesContract = PublicInstanceLooksLike<typeof MobileFiles, MobileFilesDomain>;

const wndContract: WndContract = true;
const tabContract: TabContract = true;
const outlineContract: OutlineContract = true;
const dockContract: DockContract = true;
const layoutContract: LayoutContract = true;
const graphContract: GraphContract = true;
const customListsContract: CustomListsContract = true;
const treeContract: TreeContract = true;
const treeKeyContract: TreeKeyContract = true;
const treeImplementationContract: TreeImplementationContract = true;
const treeAbstractionContract: TreeAbstractionContract = true;
const treeUpstreamContract: TreeUpstreamContract = true;
const treeNodeUpstreamContract: TreeNodeUpstreamContract = true;
const treeBlockUpstreamContract: TreeBlockUpstreamContract = true;
const protyleContract: ProtyleContract = true;
const modelContract: ModelContract = true;
const backlinkContract: BacklinkContract = true;
const forwardlinkContract: ForwardlinkContract = true;
const filesContract: FilesContract = true;
const assetContract: AssetContract = true;
const bookmarkContract: BookmarkContract = true;
const cronjobContract: CronjobContract = true;
const customContract: CustomContract = true;
const tagContract: TagContract = true;
const searchContract: SearchContract = true;
const editorContract: EditorContract = true;
const mobileBookmarksContract: MobileBookmarksContract = true;
const mobileFilesContract: MobileFilesContract = true;

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
        assert.equal(treeKeyContract, true);
        assert.equal(treeImplementationContract, true);
        assert.equal(treeAbstractionContract, true);
        assert.equal(treeUpstreamContract, true);
        assert.equal(treeNodeUpstreamContract, true);
        assert.equal(treeBlockUpstreamContract, true);
        assert.equal(protyleContract, true);
        assert.equal(modelContract, true);
        assert.equal(backlinkContract, true);
        assert.equal(forwardlinkContract, true);
        assert.equal(filesContract, true);
        assert.equal(assetContract, true);
        assert.equal(bookmarkContract, true);
        assert.equal(cronjobContract, true);
        assert.equal(customContract, true);
        assert.equal(tagContract, true);
        assert.equal(searchContract, true);
        assert.equal(editorContract, true);
        assert.equal(mobileBookmarksContract, true);
        assert.equal(mobileFilesContract, true);
    });

    it("classifies Asset models through the stable domain brand", () => {
        assert.equal(isAssetDomain({[assetModelBrand]: "Asset"}), true);
        assert.equal(isAssetDomain({layoutModel: true}), false);
    });

    it("classifies established layout models through their domain brands", () => {
        assert.equal(isGraphDomain({[graphModelBrand]: "Graph"}), true);
        assert.equal(isOutlineDomain({[outlineModelBrand]: "Outline"}), true);
        assert.equal(isBacklinkDomain({[backlinkModelBrand]: "Backlink"}), true);
        assert.equal(isFilesDomain({[filesModelBrand]: "Files"}), true);
        assert.equal(isForwardlinkDomain({[forwardlinkModelBrand]: "Forwardlink"}), true);
        assert.equal(isBookmarkDomain({[bookmarkModelBrand]: "Bookmark"}), true);
        assert.equal(isCronjobDomain({[cronjobModelBrand]: "Cronjob"}), true);
        assert.equal(isCustomDomain({[customModelBrand]: "Custom"}), true);
        assert.equal(isTagDomain({[tagModelBrand]: "Tag"}), true);
        assert.equal(isSearchDomain({[searchModelBrand]: "Search"}), true);
        assert.equal(isEditorDomain({[editorModelBrand]: "Editor"}), true);
        assert.equal(isMobileFilesDomain({[mobileFilesModelBrand]: "MobileFiles"}), true);
        assert.equal(isMobileFilesDomain({layoutModel: true}), false);
    });
});
