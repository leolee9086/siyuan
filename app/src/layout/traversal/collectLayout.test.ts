/** 用途：注册纯 `node:test` 测试套件；使用范围：本文件布局遍历契约；解耦评估：经同域网关声明测试依赖，不进入业务实现。 */
import {describe} from "./imports";
/** 用途：注册纯 Node 测试项；使用范围：本文件两个遍历用例；解耦评估：经同域网关声明测试依赖，不进入业务实现。 */
import {it} from "./imports";
/** 用途：比较窗口和页签收集顺序；使用范围：本文件断言；解耦评估：经同域网关声明测试依赖，不进入业务实现。 */
import {assert} from "./imports";
/** 用途：收集布局页签；使用范围：验证嵌套树遍历；解耦评估：直接测试唯一领域实现。 */
import {collectLayoutTabs} from "./collectLayout";
/** 用途：收集布局窗口；使用范围：验证嵌套树遍历；解耦评估：直接测试唯一领域实现。 */
import {collectLayoutWindows} from "./collectLayout";

/** 创建满足遍历契约的测试页签。 */
function createTab(id: string) {
    const headElement = Object.create(null);
    headElement.id = id;
    return {headElement, model: {id}};
}

/** 创建满足遍历契约的测试窗口。 */
function createWindow(id: string, tabs: ReturnType<typeof createTab>[]) {
    const element = Object.create(null);
    element.id = id;
    const headersElement = Object.create(null);
    headersElement.id = `${id}-headers`;
    return {
        element,
        headersElement,
        children: tabs,
    };
}

/** 创建包含嵌套分支的测试布局树。 */
function createLayoutTree() {
    const firstWindow = createWindow("first", [createTab("a"), createTab("b")]);
    const secondWindow = createWindow("second", [createTab("c")]);
    return {layout: {children: [firstWindow, {children: [secondWindow]}]}, firstWindow, secondWindow};
}

/** 验证窗口按布局深度优先顺序收集。 */
function collectsNestedWindows() {
    const tree = createLayoutTree();
    const windows: typeof tree.firstWindow[] = [];
    collectLayoutWindows(tree.layout, windows);
    assert.deepEqual(windows, [tree.firstWindow, tree.secondWindow]);
}

/** 验证页签按窗口及窗口内原有顺序收集。 */
function collectsTabsInWindowOrder() {
    const tree = createLayoutTree();
    const tabs: ReturnType<typeof createTab>[] = [];
    collectLayoutTabs(tree.layout, tabs);
    assert.deepEqual(tabs.map((tab) => tab.headElement.id), ["a", "b", "c"]);
}

/** 注册布局遍历领域的全部契约测试。 */
function registerLayoutTraversalTests() {
    it("collects nested windows in layout order", collectsNestedWindows);
    it("collects tabs in window order", collectsTabsInWindowOrder);
}

describe("layout traversal", registerLayoutTraversalTests);
