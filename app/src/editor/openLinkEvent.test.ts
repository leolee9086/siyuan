/** 用途：注册 Node 测试套件。使用范围：链接插件事件的独立回归测试。解耦评估：测试运行器是执行边界，业务模块不依赖此导入。 */
import {describe} from "node:test";
/** 用途：登记每个回归测试用例。使用范围：链接插件事件套件定义。解耦评估：测试运行器是执行边界，业务模块不依赖此导入。 */
import {it} from "node:test";
/** 用途：断言同步取消与地址规范化结果。使用范围：本文件的行为回归验证。解耦评估：断言库只在测试边界使用，不能由业务注入替代。 */
import * as assert from "node:assert/strict";
/** 用途：派发资产打开事件。使用范围：验证资产取消传播。解耦评估：测试消费公开 API，避免耦合内部派发循环。 */
import {emitOpenAsset} from "./openLinkEvent";
/** 用途：派发普通链接打开事件。使用范围：验证普通链接取消传播。解耦评估：测试消费公开 API，避免耦合内部派发循环。 */
import {emitOpenLink} from "./openLinkEvent";
/** 用途：描述普通链接事件详情。使用范围：固定取消测试中的公开载荷类型。解耦评估：纯类型边界，不加载事件实现。 */
import type {IOpenLinkEventDetail} from "./openLinkEvent";
/** 用途：规范化普通链接事件。使用范围：验证资产排除和 HTTPS 补全。解耦评估：测试消费公开 API，避免耦合内部派发循环。 */
import {resolveOpenLinkEvent} from "./openLinkEvent";

/**
 * 作用：构造仅包含插件事件总线的链接事件宿主。
 * 意图：单测只模拟 openLinkEvent 实际读取的最小协议，避免伪造完整 App。
 * 调用时机：每个事件派发测试准备取消或允许行为时。
 * 问题/改进：不模拟 Plugin 其余生命周期字段。
 */
const createApp = (emitters: Array<(type: TEventBus, detail: unknown) => boolean>) => ({
    plugins: emitters.map((emit) => ({eventBus: {emit}})),
});

/** 验证省略 scheme 的普通链接会在插件事件前标准化为 HTTPS。 */
const testNormalizesExternalLinks = () => {
    const normalizedLink = resolveOpenLinkEvent({
        href: "example.com",
        originalHref: "example.com",
        isAsset: false,
        isLocal: false,
    });
    assert.deepEqual(normalizedLink, {
        href: "https://example.com",
        originalHref: "example.com",
        event: undefined,
    });
};

/** 验证资产链接不会进入普通链接事件。 */
const testLeavesAssetsToDedicatedEvent = () => {
    const linkEvent = resolveOpenLinkEvent({
        href: "assets/example.pdf",
        originalHref: "assets/example.pdf",
        isAsset: true,
        isLocal: true,
    });
    assert.equal(linkEvent, undefined);
};

/** 验证普通链接的第一个取消插件会停止剩余派发。 */
const testStopsAfterLinkCancellation = () => {
    const calls: number[] = [];
    const detail: IOpenLinkEventDetail = {
        href: "https://example.com",
        originalHref: "example.com",
    };
    const app = createApp([
        (type, receivedDetail) => {
            calls.push(1);
            assert.equal(type, "open-link");
            assert.equal(receivedDetail, detail);
            return true;
        },
        () => {
            calls.push(2);
            return false;
        },
        () => {
            calls.push(3);
            return true;
        },
    ]);
    assert.equal(emitOpenLink(app, detail), false);
    assert.deepEqual(calls, [1, 2]);
};

/** 验证未取消时每个插件均收到普通链接事件。 */
const testNotifiesEveryPlugin = () => {
    const calls: number[] = [];
    const app = createApp([
        () => {
            calls.push(1);
            return true;
        },
        () => {
            calls.push(2);
            return true;
        },
    ]);
    assert.equal(emitOpenLink(app, {href: "siyuan://blocks/id", originalHref: "siyuan://blocks/id"}), true);
    assert.deepEqual(calls, [1, 2]);
};

/** 验证资产事件沿用第一个取消插件获胜的语义。 */
const testStopsAfterAssetCancellation = () => {
    const calls: number[] = [];
    const app = createApp([
        () => {
            calls.push(1);
            return false;
        },
        () => {
            calls.push(2);
            return true;
        },
    ]);
    assert.equal(emitOpenAsset({app, path: "assets/example.pdf", action: "right"}), false);
    assert.deepEqual(calls, [1]);
};

/** 注册链接插件事件套件中的规范化与取消传播用例。 */
const defineLinkOpeningPluginEventSuite = () => {
    it("normalizes external links before emitting", testNormalizesExternalLinks);
    it("leaves assets to the dedicated asset event", testLeavesAssetsToDedicatedEvent);
    it("stops notifying plugins after a link opening is canceled", testStopsAfterLinkCancellation);
    it("notifies every plugin when link opening is allowed", testNotifiesEveryPlugin);
    it("uses the same first-canceler-wins behavior for assets", testStopsAfterAssetCancellation);
};

describe("link opening plugin events", defineLinkOpeningPluginEventSuite);
