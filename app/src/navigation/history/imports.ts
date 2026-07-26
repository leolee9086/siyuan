/** 用途：读取统一 SForge 状态；使用范围：导航历史注册表；解耦评估：注册表基础设施的唯一同步读取入口。 */
import {getSForgeState} from "../../config/sforge.global";
/** 导出统一状态读取。 */
export {getSForgeState};

/** 用途：写入统一 SForge 状态；使用范围：导航历史注册表初始化与重置；解耦评估：集中写入确保状态可枚举和可重置。 */
import {setSForgeState} from "../../config/sforge.global";
/** 导出统一状态写入。 */
export {setSForgeState};

/** 用途：取得导航注册表稳定键；使用范围：导航历史状态槽；解耦评估：独立 Symbol 保留键值映射的厂牌类型，不可由字符串或闭包替代。 */
import {NAVIGATION_HISTORY_REGISTRY} from "../../config/sforge.symbols";
/** 导出导航历史注册表 Symbol。 */
export {NAVIGATION_HISTORY_REGISTRY};
