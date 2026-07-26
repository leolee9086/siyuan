/** 用途：读取统一 SForge 状态；使用范围：移动键盘生命周期注册表；解耦评估：注册表基础设施的唯一同步读取入口。 */
import {getSForgeState} from "../../config/sforge.global";
/** 导出统一状态读取。 */
export {getSForgeState};

/** 用途：写入统一 SForge 状态；使用范围：移动键盘生命周期初始化与重置；解耦评估：集中写入避免模块变量和闭包状态。 */
import {setSForgeState} from "../../config/sforge.global";
/** 导出统一状态写入。 */
export {setSForgeState};

/** 用途：取得移动键盘注册表稳定键；使用范围：生命周期状态槽；解耦评估：独立 Symbol 保留精确键值映射。 */
import {MOBILE_KEYBOARD_LIFECYCLE_REGISTRY} from "../../config/sforge.symbols";
/** 导出移动键盘生命周期 Symbol。 */
export {MOBILE_KEYBOARD_LIFECYCLE_REGISTRY};

/** 用途：取得当前移动编辑器；使用范围：隐藏键盘时恢复编辑器容器；解耦评估：稳定移动宿主查询，不加载键盘工具栏实现。 */
import {getCurrentEditor} from "../util/getCurrentEditor";
/** 导出当前编辑器查询。 */
export {getCurrentEditor};

/** 用途：定位可编辑元素所属 Protyle DOM；使用范围：移动输入能力判断；解耦评估：稳定 DOM 查询实现，通过本域网关显式暴露。 */
import {hasClosestByAttribute} from "../../protyle/util/hasClosest";
/** 导出属性祖先查询。 */
export {hasClosestByAttribute};

/** 用途：定位 Protyle 编辑区；使用范围：移动输入能力判断；解耦评估：稳定 DOM 查询实现，通过本域网关显式暴露。 */
import {hasClosestByClassName} from "../../protyle/util/hasClosest";
/** 导出类名祖先查询。 */
export {hasClosestByClassName};
