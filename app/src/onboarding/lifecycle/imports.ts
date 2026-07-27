/** 用途：读取统一 SForge 状态；使用范围：引导生命周期注册表；解耦评估：直达全局状态基础设施。 */
import {getSForgeState} from "../../config/sforge.global";
/** 用途：写入统一 SForge 状态；使用范围：引导生命周期注册表；解耦评估：直达全局状态基础设施。 */
import {setSForgeState} from "../../config/sforge.global";
/** 用途：引导生命周期状态键；使用范围：注册表唯一槽；解耦评估：独立 Symbol 不依赖 UI 实现。 */
import {ONBOARDING_LIFECYCLE_STATE} from "../../config/sforge.symbols";

/** 统一状态读取能力，仅供引导生命周期注册表使用。 */
export {getSForgeState};
/** 统一状态写入能力，仅供引导生命周期注册表使用。 */
export {setSForgeState};
/** 引导生命周期唯一状态键。 */
export {ONBOARDING_LIFECYCLE_STATE};
