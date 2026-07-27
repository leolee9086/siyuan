/** 用途：完整应用外观；使用范围：具体管理器初始化与插件加载；解耦评估：type-only 直达应用抽象声明。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 用途：官方插件生态类型；使用范围：管理器唯一状态 Map；解耦评估：type-only 上游基线。 */
import type {Plugin} from "siyuan";
/** 用途：同步内核请求；使用范围：读取插件文档标题；解耦评估：直达网络实现。 */
import {fetchSyncPost} from "../../util/network/fetch";
/** 用途：加载笔记内插件；使用范围：启用生命周期；解耦评估：直达当前唯一加载实现。 */
import {加载笔记内插件} from "../loader";
/** 用途：卸载笔记内插件；使用范围：禁用和全部卸载生命周期；解耦评估：直达当前唯一卸载实现。 */
import {卸载笔记内插件} from "../loader";
/** 用途：标记插件文档；使用范围：菜单触发注册前；解耦评估：直达编译器唯一属性写入实现。 */
import {设置为插件文档} from "../compiler";
/** 用途：插件配置数据；使用范围：启用流程构建配置；解耦评估：同领域数据声明。 */
import type {笔记内插件配置} from "../types";
/** 用途：插件运行状态；使用范围：管理器状态 Map 与查询；解耦评估：同领域数据声明。 */
import type {笔记内插件运行状态} from "../types";

/** 导出完整应用外观。 */
export type {AppFacade};
/** 导出官方插件类型。 */
export type {Plugin};
/** 导出内核请求。 */
export {fetchSyncPost};
/** 导出插件加载实现。 */
export {加载笔记内插件};
/** 导出插件卸载实现。 */
export {卸载笔记内插件};
/** 导出插件文档标记实现。 */
export {设置为插件文档};
/** 导出插件配置数据。 */
export type {笔记内插件配置};
/** 导出插件运行状态。 */
export type {笔记内插件运行状态};
