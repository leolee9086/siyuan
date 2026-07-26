/** 用途：AV 定位注册表唯一键；使用范围：状态初始化和重置；解耦评估：直达全局 Symbol 声明。 */
import {AV_LOCATE_REGISTRY} from "../../../../../config/sforge.symbols";
/** 导出 AV 定位状态键。 */
export {AV_LOCATE_REGISTRY};

/** 用途：读取统一状态；使用范围：全部定位状态查询；解耦评估：直达 SForge 状态唯一实现。 */
import {getSForgeState} from "../../../../../config/sforge.global";
/** 导出统一状态读取。 */
export {getSForgeState};

/** 用途：写入统一状态；使用范围：定位状态初始化和重置；解耦评估：直达 SForge 状态唯一实现。 */
import {setSForgeState} from "../../../../../config/sforge.global";
/** 导出统一状态写入。 */
export {setSForgeState};

/** 用途：读取 AV 视图属性名；使用范围：构造定位请求参数；解耦评估：直达协议常量所有者。 */
import {Constants} from "../../../../../constants";
/** 导出 AV 协议常量。 */
export {Constants};
