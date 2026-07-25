import assert from "node:assert/strict";
import {afterEach, describe, it} from "node:test";
import {SForgeSymbols} from "../../src/config/sforge.symbols";
import {setSForgeState} from "../../src/config/sforge.global";
import {tabRegistry} from "../../src/registry/TabRegistry";
import {createTestPanelElement} from "./TabRegistryTestDom.factory";

/** 清除全局 Tab 注册 Map，确保每个测试从独立状态开始；在每个用例结束后调用。 */
// @柯里化 测试生命周期固定清除同一个状态键。
const resetRegistry = () => setSForgeState(SForgeSymbols.TAB_TYPE_REGISTRY, undefined);
/** 提供不修改模型的注册初始化回调，用于只验证注册表协议的测试。 */
const initializeModel = () => undefined;

afterEach(resetRegistry);

// @内联回调 Node 测试套件声明需要在回调内同步注册所有子用例。
describe("TabRegistry", () => {
    // @内联回调 测试步骤保持在用例声明处便于核对完整行为。
    it("preserves the first registration for a type", () => {
        const first = {type: "test-tab", init: initializeModel};
        const second = {type: "test-tab", init: initializeModel};

        assert.equal(tabRegistry.register(first), true);
        assert.equal(tabRegistry.register(second), false);
        assert.equal(tabRegistry.get("test-tab"), first);
    });

    // @内联回调 测试步骤保持在用例声明处便于核对完整工厂上下文。
    it("passes the resolved registration to the host model factory", () => {
        const panelElement = createTestPanelElement();
        const registration = {type: "factory-tab", init: initializeModel};
        const application = {id: "app"};
        const tab = {panelElement};
        const data = {value: 42};
        tabRegistry.register(registration);

        const model = tabRegistry.createModel(
            {app: application, tab, type: registration.type, data},
            // @内联回调 断言必须在实际工厂调用栈内核对完整上下文。
            context => {
                assert.equal(context.registration, registration);
                assert.equal(context.app, application);
                assert.equal(context.tab, tab);
                assert.equal(context.data, data);
                const result = {
                    element: panelElement,
                    tab,
                    data,
                    type: registration.type,
                    editors: [],
                };
                return result;
            },
        );

        assert.equal(model?.data, data);
    });

    // @内联回调 测试步骤保持在用例声明处便于核对未注册分支。
    it("does not invoke the host factory for an unregistered type", () => {
        let invoked = false;
        const model = tabRegistry.createModel({app: {}, tab: {}, type: "missing", data: {}}, () => {
            invoked = true;
            throw new Error("factory must not run");
        });

        assert.equal(model, null);
        assert.equal(invoked, false);
    });

    it("removes registrations synchronously", () => {
        tabRegistry.register({type: "temporary", init: initializeModel});
        assert.equal(tabRegistry.unregister("temporary"), true);
        assert.equal(tabRegistry.has("temporary"), false);
    });
});
