/** 用途：导出布局请求。使用范围：主窗口持久化后回调；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};

/** 用途：窗口模式判断。使用范围：独立窗口导出；解耦评估：稳定平台事实。 */
import {isWindow} from "../../util/platform/functions";
/** 导出窗口模式判断。 */
export {isWindow};

/** 用途：保存编辑器滚动位置。使用范围：导出前刷新文档状态；解耦评估：仅 export 子域依赖 Protyle，不污染普通保存链。 */
import {saveScroll} from "../../protyle/scroll/saveScroll";
/** 导出滚动保存。 */
export {saveScroll};

/** 用途：获取完整编辑器集合。使用范围：导出前逐一保存滚动；解耦评估：返回 ProtyleDomain，不加载具体 Protyle class。 */
import {getAllEditor} from "../getAll";
/** 导出编辑器集合查询。 */
export {getAllEditor};

/** 用途：读取当前配置和布局。使用范围：主窗口导出；解耦评估：导出组合边界的环境事实。 */
import {getSiyuanConfig, getSiyuanLayout} from "../dock/dock.environment";
/** 导出配置读取。 */
export {getSiyuanConfig};
/** 导出布局读取。 */
export {getSiyuanLayout};

/** 用途：共享布局快照。使用范围：主窗口与独立窗口导出；解耦评估：唯一持久化实现。 */
import {buildMainWindowLayoutJSON, serializeWindowModeLayout} from "../persistence/layoutSnapshot";
/** 导出主窗口快照构建。 */
export {buildMainWindowLayoutJSON};
/** 导出独立窗口快照构建。 */
export {serializeWindowModeLayout};

/** 用途：递归布局序列化。使用范围：导出主布局；解耦评估：唯一持久化算法。 */
import {layoutToJSON} from "../persistence/layoutSerializer";
/** 导出递归布局序列化。 */
export {layoutToJSON};

/** 用途：布局 JSON。使用范围：导出请求数据；解耦评估：纯类型依赖。 */
import type {SerializationJSON} from "../layout-serialization.types";
/** 导出布局 JSON 类型。 */
export type {SerializationJSON};
