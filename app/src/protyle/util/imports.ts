/**
 * 用途：从父级 platform 模块转发 isMobile，供 protyle/util 目录下的模块使用
 * 使用范围：protyle/util 目录下需要检测移动端环境的模块
 * 解耦评估：平台检测基础设施，通过 imports.ts 统一转发减少模块对父级目录的直接依赖
 */
import { isMobile } from "../../platform";
/** 导出 isMobile，供 protyle/util 目录复用 */
export { isMobile };

/**
 * 用途：从 config/sforge 转发 SForgeSymbols，供 protyle/util 目录下需要使用全局注册表的模块使用
 * 使用范围：protyle/util 下需要存取注册表状态的模块（如 dragTip.ts）
 * 解耦评估：全局注册表是架构核心基础设施，通过 imports.ts 统一转发减少模块对父级目录的直接依赖
 */
import { SForgeSymbols } from "../../config/sforge";
/** 导出 SForgeSymbols，供 protyle/util 目录复用 */
export { SForgeSymbols };

/**
 * 用途：从 config/sforge 转发 getSForgeState，供 protyle/util 目录下需要使用全局注册表的模块使用
 * 使用范围：protyle/util 下需要读取注册表状态的模块（如 dragTip.ts）
 * 解耦评估：全局注册表是架构核心基础设施，通过 imports.ts 统一转发减少模块对父级目录的直接依赖
 */
import { getSForgeState } from "../../config/sforge";
/** 导出 getSForgeState，供 protyle/util 目录复用 */
export { getSForgeState };

/**
 * 用途：从 config/sforge 转发 setSForgeState，供 protyle/util 目录下需要使用全局注册表的模块使用
 * 使用范围：protyle/util 下需要写入注册表状态的模块（如 dragTip.ts）
 * 解耦评估：全局注册表是架构核心基础设施，通过 imports.ts 统一转发减少模块对父级目录的直接依赖
 */
import { setSForgeState } from "../../config/sforge";
/** 导出 setSForgeState，供 protyle/util 目录复用 */
export { setSForgeState };

/**
 * 用途：读取视图折叠的高层视觉端口，供低层折叠状态在标题异步加载后请求渲染。
 * 使用范围：仅 `viewFold.ts` 的标题子块加载收尾，不承担 AV、块渲染或 onGet 实现。
 * 解耦评估：将渲染函数作为静态组合层注册的端口读取，避免 viewFold 反向依赖 AV、块渲染和 onGet；逐层参数传递会把同一能力扩散到所有折叠 helper，事件也不能保证当前 DOM 插入后的同步渲染顺序。
 */
import {getViewFoldVisualEffects} from "./viewFoldVisual/port";
/** 导出视图折叠视觉端口读取函数。 */
export {getViewFoldVisualEffects};

/**
 * 用途：定位块内真实可编辑元素，供选区撤销上下文使用
 * 使用范围：仅 protyle/util 的选区恢复模块
 * 解耦评估：这是无状态 DOM 查询能力，经本目录依赖入口复用比传递整个 Protyle 宿主更细
 */
import {getContenteditableElement} from "../wysiwyg/getBlock";
/** 导出可编辑元素查询能力，供选区恢复复用。 */
export {getContenteditableElement};
