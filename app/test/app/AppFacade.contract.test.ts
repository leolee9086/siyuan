import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import type * as LocalApp from "../../src/index";
import type * as LocalEventBus from "../../src/plugin/EventBus";
import type * as LocalPlugin from "../../src/plugin";
import type * as Siyuan from "siyuan";
import {createAppFacade} from "../../src/app/AppFacade.types";
import type {AppFacade, AppFacadeShape} from "../../src/app/AppFacade.types";
import type {IsAssignable, StrictEqual} from "../../src/util/types/LooksLike.types";

type AppFacadeContract = StrictEqual<LocalApp.App, AppFacadeShape<LocalPlugin.Plugin, LocalEventBus.EventBus>>;
type PluginCompatibility = IsAssignable<LocalPlugin.Plugin, Siyuan.Plugin>;
type EventBusCompatibility = IsAssignable<LocalEventBus.EventBus, Siyuan.EventBus>;

const appFacadeContract: AppFacadeContract = true;
const pluginCompatibility: PluginCompatibility = true;
const eventBusCompatibility: EventBusCompatibility = true;

const testFacade = createAppFacade({
    plugins: [],
    appId: "test-app",
    eventBus: {},
});
const brandedFacade: AppFacade<object, object> = testFacade;

describe("AppFacade contracts", () => {
    it("keeps the concrete application public surface equal to the abstract shape", () => {
        assert.equal(appFacadeContract, true);
        assert.equal(pluginCompatibility, true);
        assert.equal(eventBusCompatibility, true);
    });

    it("brands the existing application surface without changing its identity", () => {
        assert.equal(brandedFacade, testFacade);
        assert.equal(testFacade.appId, "test-app");
    });
});
