import type * as Siyuan from "siyuan";
import {createAppFacade} from "../../src/app/AppFacade.types";
import type {AppFacade} from "../../src/app/AppFacade.types";
import {EventBus} from "../../src/plugin/EventBus";
import {createInNotePluginManagerFixture} from "../inNotePlugin/InNotePluginManager.fixture";

/** 创建覆盖完整公共表面的带厂牌 AppFacade 测试夹具。 */
export const createTestAppFacade = (
    openBlock: AppFacade["openBlock"] = () => undefined,
) => createAppFacade<Siyuan.Plugin, EventBus>({
    plugins: [],
    appId: "test-app",
    eventBus: new EventBus(document),
    inNotePluginManager: createInNotePluginManagerFixture(),
    pluginHost: {
        reloadData: () => undefined,
        addDock: () => undefined,
    },
    createProtyle: () => {
        throw new Error("Test AppFacade Protyle factory was not configured");
    },
    getOpenEditors: () => [],
    getOpenModels: () => ({
        editor: [], graph: [], asset: [], outline: [], backlink: [], search: [], inbox: [],
        files: [], bookmark: [], tag: [], custom: [], forwardlink: [],
    }),
    openSettings: () => undefined,
    openSearch: () => undefined,
    createDocument: async () => undefined,
    createDocumentInTree: async () => undefined,
    handleUnavailableDocument: () => undefined,
    toggleFullscreen: () => undefined,
    openGlobalSearch: () => undefined,
    openTab: async () => undefined,
    openAsset: () => undefined,
    openBlock,
    openDatabaseRow: () => undefined,
    processSiYuanUri: () => false,
});
