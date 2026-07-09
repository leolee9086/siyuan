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
