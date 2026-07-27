/** 用途：读写 SForge 全局状态；使用范围：动作注册表；解耦评估：直达状态唯一实现，不经过其它 imports 网关。 */
import {getSForgeState, setSForgeState} from "../../../../config/sforge.global";
/** 用途：标识动作注册状态；使用范围：动作注册表；解耦评估：直达不可变 Symbol 声明。 */
import {FRONTEND_ACTION_REGISTRY} from "../../../../config/sforge.symbols";

/** 前端动作注册子域使用的状态身份。 */
export {FRONTEND_ACTION_REGISTRY};
/** 前端动作注册子域使用的状态读取能力。 */
export {getSForgeState};
/** 前端动作注册子域使用的状态写入能力。 */
export {setSForgeState};
