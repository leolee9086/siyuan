/** 用途：AV 虚拟滚动注册表唯一键。使用范围：state.ts 初始化和重置；解耦评估：直达全局 Symbol 声明，不经其它 imports 网关。 */
import {AV_VIRTUAL_SCROLL_REGISTRY} from "../../../../config/sforge.symbols";
/** 导出注册表唯一键供状态所有者使用。 */
export {AV_VIRTUAL_SCROLL_REGISTRY};

/** 用途：读取统一 SForge 状态。使用范围：state.ts 注册表访问；解耦评估：直达全局状态唯一实现，闭包或事件不能替代同步状态所有权。 */
import {getSForgeState} from "../../../../config/sforge.global";
/** 导出统一状态读取能力。 */
export {getSForgeState};

/** 用途：写入统一 SForge 状态。使用范围：state.ts 注册表初始化和重置；解耦评估：直达全局状态唯一实现。 */
import {setSForgeState} from "../../../../config/sforge.global";
/** 导出统一状态写入能力。 */
export {setSForgeState};

/** 用途：构造 AV 视图状态键。使用范围：数据源登记和查询；解耦评估：协议属性名由唯一常量所有者维护。 */
import {Constants} from "../../../../constants";
/** 导出 AV 协议常量。 */
export {Constants};
