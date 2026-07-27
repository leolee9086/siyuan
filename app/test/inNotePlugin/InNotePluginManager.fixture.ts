import type {Plugin} from "siyuan";
import {inNotePluginManagerBrand} from "../../src/inNotePlugin/manager/inNotePluginManager.types";
import type {InNotePluginManagerDomain} from "../../src/inNotePlugin/manager/inNotePluginManager.types";

export const createInNotePluginManagerFixture = <TApplication extends object>(): InNotePluginManagerDomain<TApplication> => ({
    [inNotePluginManagerBrand]: "InNotePluginManager",
    init: async () => undefined,
    启用插件: async () => true,
    禁用插件: async () => undefined,
    重载插件: async () => true,
    获取所有插件: () => [],
    获取插件状态: () => undefined,
    是否已启用: () => false,
    设置为插件文档: async () => true,
    卸载所有插件: async () => undefined,
}) satisfies InNotePluginManagerDomain<TApplication, Plugin>;
