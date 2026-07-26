/** 用途：读取和写入统一 SForge 状态注册表。使用范围：布局持久化重试状态；解耦评估：集中注册表替代模块闭包和局部全局变量。 */
import {getSForgeState, setSForgeState} from "../../../config/sforge.global";
/** 导出统一状态读取。 */
export {getSForgeState};
/** 导出统一状态写入。 */
export {setSForgeState};

/** 用途：统一注册表 Symbol。使用范围：布局持久化注册表键；解耦评估：不可变模块身份键。 */
import {LAYOUT_PERSISTENCE_REGISTRY} from "../../../config/sforge.symbols";
/** 导出布局持久化注册表 Symbol。 */
export {LAYOUT_PERSISTENCE_REGISTRY};
