/**
 * Vue 组件挂载相关类型定义
 *
 * 集中承载 createVueComponentLoader 等工具的挂载配置与加载上下文接口，遵循 "类型生活在 *.types.ts" 的架构约束，避免在业务/UI 文件中定义 interface。
 */

/**
 * 用途：Vue 组件类型，用于标注挂载配置中要注册的组件集合。
 * 使用范围：VueComponentMountConfig.components 字段。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { Component } from "./imports";

/**
 * 用途：Vue 包装器配置类型，用于通过高阶组件对组件进行 props/emit 拦截与生命周期增强。
 * 使用范围：VueComponentMountConfig.wrapperConfig 字段。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { ComponentWrapperConfig } from "./wrapper";

/**
 * 用途：Vue 包装器函数类型，用于自定义包装逻辑。
 * 使用范围：VueComponentMountConfig.wrapper 字段。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { ComponentWrapper } from "./wrapper";

/**
 * Vue 模板负责按组件事件契约调用处理器，挂载层只透传函数引用。
 * `never[]` 接受具有具体参数签名的处理器，同时阻止挂载层自行构造参数调用它们。
 */
export type ComponentEventHandler = (...args: never[]) => unknown;

/**
 * Vue 组件挂载配置接口，描述将一组组件挂载到容器所需的组件、数据、模板与包装器等输入
 */
export interface VueComponentMountConfig {
    /** 要注册的组件 */
    components: Record<string, Component>;
    /** 组件props数据 */
    data?: Record<string, unknown> | undefined;
    /** 事件处理器 */
    eventHandlers?: Record<string, ComponentEventHandler> | undefined;
    /** 组件模板 */
    template?: string | undefined;
    /** 挂载后要调用的方法名 */
    initMethodName?: string | undefined;
    /** 初始化方法参数 */
    initMethodParams?: readonly unknown[] | undefined;
    /** 组件包装器配置 */
    wrapperConfig?: ComponentWrapperConfig | undefined;
    /** 组件包装器函数 */
    wrapper?: ComponentWrapper | undefined;
}

/**
 * Vue 组件加载器上下文接口，用于向挂载的组件注入状态读取与写入方法
 */
export interface VueComponentLoaderContext {
    /** 获取状态 */
    getState<T = unknown>(key: string): T;
    /** 设置状态 */
    setState(key: string, value: unknown): void;
}
