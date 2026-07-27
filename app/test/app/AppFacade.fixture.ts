import type * as Siyuan from "siyuan";
import {createAppFacade} from "../../src/app/AppFacade.types";
import type {AppFacade} from "../../src/app/AppFacade.types";
import {EventBus} from "../../src/plugin/EventBus";

/** 创建覆盖完整公共表面的带厂牌 AppFacade 测试夹具。 */
export const createTestAppFacade = (
    openBlock: AppFacade["openBlock"] = () => undefined,
) => createAppFacade<Siyuan.Plugin, EventBus>({
    plugins: [],
    appId: "test-app",
    eventBus: new EventBus(document),
    pluginHost: {
        reloadData: () => undefined,
        addDock: () => undefined,
    },
    openAsset: () => undefined,
    openBlock,
    openDatabaseRow: () => undefined,
    processSiYuanUri: () => false,
});
