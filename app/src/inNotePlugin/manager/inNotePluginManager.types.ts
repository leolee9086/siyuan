/** 用途：官方插件生态类型；使用范围：笔记内插件运行状态公开表面；解耦评估：type-only 上游兼容基线。 */
import type {Plugin} from "siyuan";
/** 用途：笔记内插件运行状态；使用范围：完整管理器查询结果；解耦评估：同领域数据声明。 */
import type {笔记内插件运行状态} from "../types";

/** 笔记内插件管理器稳定身份；只用于完整领域根判别，不保存状态。 */
export const inNotePluginManagerBrand = Symbol("InNotePluginManager");

/**
 * 笔记内插件管理器的完整公共领域表面。
 * 应用类型保持泛型以避免抽象外观与管理器产生声明层反向导入；插件实例以官方 siyuan.Plugin 为默认生态边界。
 */
export interface InNotePluginManagerDomain<
    TApplication extends object,
    TPlugin extends Plugin = Plugin,
> {
    readonly [inNotePluginManagerBrand]: "InNotePluginManager";
    init(app: TApplication): Promise<void>;
    启用插件(docId: string, displayName: string): Promise<boolean>;
    禁用插件(docId: string): Promise<void>;
    重载插件(docId: string): Promise<boolean>;
    获取所有插件(): 笔记内插件运行状态<TPlugin>[];
    获取插件状态(docId: string): 笔记内插件运行状态<TPlugin> | undefined;
    是否已启用(docId: string): boolean;
    设置为插件文档(docId: string): Promise<boolean>;
    卸载所有插件(): Promise<void>;
}

/** @同步豁免: 类型守卫 */
/** 按稳定厂牌收窄为完整管理器领域根。 @显式返回类型原因：类型谓词必须显式声明以提供控制流收窄。 */
export const isInNotePluginManagerDomain = <TApplication extends object>(
    manager: object,
): manager is InNotePluginManagerDomain<TApplication> =>
    inNotePluginManagerBrand in manager && manager[inNotePluginManagerBrand] === "InNotePluginManager";
