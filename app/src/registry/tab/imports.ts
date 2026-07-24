/** 用途：Tab 注册表状态键。使用范围：读取和写入全局注册 Map。解耦评估：稳定状态基础设施，不依赖布局实现。 */
import {SForgeSymbols} from "../../config/sforge.symbols";
/** 用途：Tab 注册表状态读取。使用范围：获取当前注册 Map。解耦评估：稳定状态基础设施。 */
import {getSForgeState} from "../../config/sforge.global";
/** 用途：Tab 注册表状态写入。使用范围：首次初始化注册 Map。解耦评估：稳定状态基础设施。 */
import {setSForgeState} from "../../config/sforge.global";

/** Tab 注册表状态键。 */
export {SForgeSymbols};
/** Tab 注册表状态读取器。 */
export {getSForgeState};
/** Tab 注册表状态写入器。 */
export {setSForgeState};
