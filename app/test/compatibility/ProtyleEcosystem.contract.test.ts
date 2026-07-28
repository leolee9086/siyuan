import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type * as Siyuan from "siyuan";
import type {RebindSiyuanRuntime} from "../../src/plugin/compatibility/SiyuanPluginRuntime.types";
import type {IsAssignable, StrictEqual} from "../../src/util/types/LooksLike.types";

type SharedInternalOptions = Omit<IProtyleOptions, "mode" | "after" | "status" | "toolbar" | "preview" | "hint">;
type SharedOfficialOptions = Omit<Siyuan.IProtyleOptions, "mode" | "after" | "toolbar" | "preview" | "hint">;
type SharedOptionsEqual = StrictEqual<SharedInternalOptions, SharedOfficialOptions>;
type SharedOptionsOfficialToInternal = IsAssignable<SharedOfficialOptions, SharedInternalOptions>;
type SharedOptionsInternalToOfficial = IsAssignable<SharedInternalOptions, SharedOfficialOptions>;
type SharedOptionChecks = {
    [K in keyof SharedInternalOptions & keyof SharedOfficialOptions]:
        IsAssignable<Pick<SharedInternalOptions, K>, Pick<SharedOfficialOptions, K>> extends true
            ? IsAssignable<Pick<SharedOfficialOptions, K>, Pick<SharedInternalOptions, K>>
            : false
};
const sharedOptionChecks: SharedOptionChecks = {
    databaseAttr: true,
    history: true,
    backlinkData: true,
    action: true,
    scrollPosition: true,
    blockId: true,
    rootId: true,
    notebookId: true,
    originalRefBlockIDs: true,
    key: true,
    defIds: true,
    render: true,
    _lutePath: true,
    typewriterMode: true,
    upload: true,
    classes: true,
    click: true,
    handleEmptyContent: true,
    lite: true,
};

type ReboundOfficialOptions = RebindSiyuanRuntime<Siyuan.IProtyleOptions>;
type ReboundOptionsToInternal = IsAssignable<ReboundOfficialOptions, IProtyleOptions>;
type InternalOptionsToRebound = IsAssignable<IProtyleOptions, ReboundOfficialOptions>;
type ReboundOfficialState = RebindSiyuanRuntime<Siyuan.IProtyle>;
type ReboundStateToInternal = IsAssignable<ReboundOfficialState, IProtyle>;
type InternalModeContract = StrictEqual<NonNullable<IProtyleOptions["mode"]>, "wysiwyg">;
type OfficialModeContract = StrictEqual<NonNullable<Siyuan.IProtyleOptions["mode"]>, "preview" | "wysiwyg">;
type InternalImageAction = Extract<NonNullable<NonNullable<IProtyleOptions["preview"]>["actions"]>[number], "image">;
type OfficialImageAction = Extract<NonNullable<NonNullable<Siyuan.IProtyleOptions["preview"]>["actions"]>[number], "image">;
type InternalImageActionContract = StrictEqual<InternalImageAction, "image">;
type OfficialImageActionContract = StrictEqual<OfficialImageAction, never>;
type StatusExtensionContract = StrictEqual<IProtyleOptions["status"], HTMLElement | string | undefined>;
type LiteCompatibilityContract = StrictEqual<IProtyleOptions["lite"], Siyuan.IProtyleOptions["lite"]>;

const sharedOptionsEqual: SharedOptionsEqual = true;
const sharedOptionsOfficialToInternal: SharedOptionsOfficialToInternal = true;
const sharedOptionsInternalToOfficial: SharedOptionsInternalToOfficial = true;
const reboundOptionsToInternal: ReboundOptionsToInternal = true;
const internalOptionsToRebound: InternalOptionsToRebound = true;
const reboundStateToInternal: ReboundStateToInternal = true;
const internalModeContract: InternalModeContract = true;
const officialModeContract: OfficialModeContract = true;
const internalImageActionContract: InternalImageActionContract = true;
const officialImageActionContract: OfficialImageActionContract = true;
const statusExtensionContract: StatusExtensionContract = true;
const liteCompatibilityContract: LiteCompatibilityContract = true;

/** Plugin 边界使用生产适配映射接收官方选项，确保扩展配置不会绕过内部变体适配。 */
const acceptOfficialProtyleOptions = (
    options: RebindSiyuanRuntime<Siyuan.IProtyleOptions>,
): IProtyleOptions => options;
const acceptOfficialProtyleState = (
    state: ReboundOfficialState,
): IProtyle => state;

describe("Siyuan Protyle ecosystem contracts", () => {
    it("keeps the stable official option surface compatible", () => {
        assert.equal(sharedOptionsEqual, true);
        assert.equal(sharedOptionsOfficialToInternal, true);
        assert.equal(sharedOptionsInternalToOfficial, true);
        assert.equal(sharedOptionChecks.databaseAttr, true);
        assert.equal(reboundOptionsToInternal, true);
        assert.equal(internalOptionsToRebound, true);
        assert.equal(internalModeContract, true);
        assert.equal(officialModeContract, true);
        assert.equal(internalImageActionContract, true);
        assert.equal(officialImageActionContract, true);
        assert.equal(statusExtensionContract, true);
        assert.equal(liteCompatibilityContract, true);
        assert.equal(typeof acceptOfficialProtyleOptions, "function");
        assert.equal(typeof acceptOfficialProtyleState, "function");
        assert.equal(reboundStateToInternal, true);
    });
});
