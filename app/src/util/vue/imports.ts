/**
 * Vue 挂载工具模块的依赖网关
 *
 * 集中转发对第三方库 vue 的依赖，避免业务文件直接 import 第三方包而掩盖依赖边界。本目录同级的 ./wrapper、./mount.types、./mount.guard 等内部模块仍由各业务文件直接导入，不经此网关。
 */

/**
 * 用途：创建 Vue 应用实例的工厂函数，用于把组件挂载到 DOM 容器。
 * 使用范围：mount.ts 中 createVueComponentLoader 等挂载流程。
 * 解耦评估：第三方库入口，通过网关统一转发；如需替换渲染引擎可在此层抽象。
 */
import { createApp } from "vue";
/** 导出 createApp，供 Vue 挂载工具生成应用实例 */
export { createApp };

/**
 * 用途：Vue 应用实例类型，用于标注挂载函数的返回值。
 * 使用范围：mount.ts 中各导出函数的返回类型。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { App } from "vue";
/** 导出 App 类型，供 Vue 挂载工具标注返回值 */
export type { App };

/**
 * 用途：Vue 组件类型，用于标注挂载配置与包装器输入中的组件。
 * 使用范围：mount.types.ts 接口字段、mount.ts 包装器加载器参数。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { Component } from "vue";
/** 导出 Component 类型，供类型定义与挂载工具使用 */
export type { Component };

/**
 * 用途：Vue 组件公共实例类型，用于标注 app.mount 返回值并安全访问 $refs。
 * 使用范围：mount.guard.ts 类型守卫入参、mount.ts 挂载实例局部变量。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { ComponentPublicInstance } from "vue";
/** 导出 ComponentPublicInstance 类型，供守卫与挂载工具标注实例 */
export type { ComponentPublicInstance };