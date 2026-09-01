/** 用途：查找现有 Search 模型；使用范围：优先复用当前搜索面板；解耦评估：直达布局查询唯一实现，具体依赖只留在 App 组合能力内部。 */
import {getAllModels} from "../../layout/getAll";
/** 导出布局模型查询。 */
export {getAllModels};

/** 用途：读取本地搜索数据键；使用范围：创建新的全局搜索；解耦评估：直达稳定协议常量。 */
import {Constants} from "../../constants";
/** 导出搜索常量。 */
export {Constants};

/** 用途：读取完整应用配置；使用范围：搜索方法与分屏决策；解耦评估：直达严格环境访问器，缺失配置时显式失败。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出应用配置访问器。 */
export {getSiyuanConfig};

/** 用途：读取完整应用布局；使用范围：搜索分屏决策；解耦评估：直达严格环境访问器，避免散落 window 访问。 */
import {getSiyuanLayout} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出应用布局访问器。 */
export {getSiyuanLayout};

/** 用途：读取完整应用存储；使用范围：恢复搜索选项；解耦评估：直达严格环境访问器，测试可经子域网关替换。 */
import {getSiyuanStorage} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出应用存储访问器。 */
export {getSiyuanStorage};

/** 用途：识别加密笔记本；使用范围：全局搜索敏感态判定；解耦评估：直达加密子域唯一判定实现。 */
import {isEncryptedBox} from "../../util/file/notebook/store";
/** 导出加密笔记本判定。 */
export {isEncryptedBox};

/** 用途：约束搜索宿主为完整应用外观；使用范围：创建 Search 页签；解耦评估：纯类型直达抽象领域根，不加载具体 App。 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 导出完整应用外观。 */
export type {AppFacade};
