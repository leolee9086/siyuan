/**
 * 用途：从父级 platform 模块转发 isMobile，供 protyle/util 目录下的模块使用
 * 使用范围：protyle/util 目录下需要检测移动端环境的模块
 * 解耦评估：平台检测基础设施，通过 imports.ts 统一转发减少模块对父级目录的直接依赖
 */
import { isMobile } from "../../platform";
/** 导出 isMobile，供 protyle/util 目录复用 */
export { isMobile };
