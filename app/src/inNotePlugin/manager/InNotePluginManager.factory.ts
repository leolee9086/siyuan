/** 用途：具体管理器 class；使用范围：应用组合根创建唯一领域实例；解耦评估：具体类型只在 factory 边界加载。 */
import {InNotePluginManager} from "./InNotePluginManager";

/** 创建拥有独立状态与生命周期的完整笔记内插件管理器。 @同步豁免: 生命周期 */
export const createInNotePluginManager = () => new InNotePluginManager();
