/**
 * Vue 组件挂载工具
 *
 * 提供 Vue 应用实例的创建与挂载能力，支持组件包装器、上下文注入与挂载后的初始化方法回调。类型定义集中在 mount.types.ts，断言式访问收敛在 mount.guard.ts。
 */

/**
 * 用途：创建 Vue 应用实例的工厂函数，用于把组件挂载到 DOM 容器。
 * 使用范围：本文件所有挂载流程共享。
 * 解耦评估：第三方库入口，通过 imports.ts 网关转发，避免直接耦合 vue 包路径。
 */
import { createApp } from "./imports";
/**
 * 用途：Vue 应用实例类型，标注挂载函数返回值。
 * 使用范围：各导出函数返回类型。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { App } from "./imports";
/**
 * 用途：Vue 组件类型，标注包装器加载器参数中的组件。
 * 使用范围：createWrappedVueComponentLoader / createCustomWrappedVueComponentLoader。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { Component } from "./imports";
/**
 * 用途：Vue 组件公共实例类型，标注 app.mount 返回值以访问 $refs。
 * 使用范围：createVueComponentLoader 内部挂载实例变量。
 * 解耦评估：类型导入，无运行时耦合。
 */
import type { ComponentPublicInstance } from "./imports";
/**
 * 用途：Vue 组件挂载配置类型，描述挂载输入的组件、数据、模板与包装器。
 * 使用范围：所有挂载函数的 config 参数。
 * 解耦评估：类型定义集中在 mount.types.ts。
 */
/**
 * 用途：Vue 组件挂载配置类型，描述挂载输入的组件、数据、模板与包装器。
 * 使用范围：所有挂载函数的 config 参数。
 * 解耦评估：类型定义集中在 mount.types.ts。
 */
import type { VueComponentMountConfig } from "./mount.types";
/**
 * 用途：Vue 组件加载器上下文类型，描述注入给挂载组件的状态读写方法。
 * 使用范围：挂载函数的 context 参数。
 * 解耦评估：类型定义集中在 mount.types.ts。
 */
import type { VueComponentLoaderContext } from "./mount.types";
/**
 * 用途：组件事件处理器函数类型，替代宽泛的 Function。
 * 使用范围：包装器加载器参数与 setup 合并对象。
 * 解耦评估：类型定义集中在 mount.types.ts。
 */
import type { ComponentEventHandler } from "./mount.types";
/**
 * 用途：setup 合并后对象条目值类型，既可能是数据也可能是事件处理器。
 * 使用范围：buildSetupReturnData 返回对象。
 * 解耦评估：类型定义集中在 mount.types.ts。
 */
import type { MergedSetupValue } from "./mount.types";
/**
 * 用途：组件包装器创建函数，用于包装一个组件得到增强组件。
 * 使用范围：applyWrapperToComponent。
 * 解耦评估：同级内部模块直接导入。
 */
import { createComponentWrapper } from "./wrapper";
/**
 * 用途：Vue 组件类型，标注包装器输入与中间产物。
 * 使用范围：applyWrapperToComponent 入参与内部映射。
 * 解耦评估：同级内部模块直接导入。
 */
import type { VueComponent } from "./wrapper";
/**
 * 用途：组件包装器配置类型，描述对组件的 props/emit 拦截与生命周期增强。
 * 使用范围：createWrappedVueComponentLoader 参数。
 * 解耦评估：同级内部模块直接导入。
 */
import type { ComponentWrapperConfig } from "./wrapper";
/**
 * 用途：自定义包装器函数类型。
 * 使用范围：createCustomWrappedVueComponentLoader 参数。
 * 解耦评估：同级内部模块直接导入。
 */
import type { ComponentWrapper } from "./wrapper";
/**
 * 用途：$refs 与初始化方法的类型守卫，替代原 `as any` 断言。
 * 使用范围：createVueComponentLoader 挂载后初始化逻辑。
 * 解耦评估：同级守卫模块，守卫逻辑收敛于此以便复用与测试。
 */
/**
 * 用途：$refs 存在性守卫，用于安全访问挂载实例的模板引用表。
 * 使用范围：invokeInitMethod 挂载后初始化逻辑。
 * 解耦评估：守卫逻辑收敛在 mount.guard.ts 以便复用。
 */
import { hasVueRefs } from "./mount.guard";
/**
 * 用途：初始化方法可调用性守卫，用于安全触发子组件方法。
 * 使用范围：invokeInitMethod 挂载后初始化逻辑。
 * 解耦评估：守卫逻辑收敛在 mount.guard.ts 以便复用。
 */
import { hasInitMethod } from "./mount.guard";
/**
 * 用途：HTMLElement 守卫，用于把 querySelector 结果收窄为可挂载的 HTMLElement。
 * 使用范围：createVueComponentInDialog 定位对话框主体。
 * 解耦评估：守卫逻辑收敛在 mount.guard.ts 以便复用。
 */
import { isHTMLElement } from "./mount.guard";
/**
 * 用途：对话框实例类型，用于读取对话框主体元素以承载 Vue 应用。
 * 使用范围：createVueComponentInDialog 参数。
 * 解耦评估：父级类型导入，无运行时耦合。
 */
import type { Dialog } from "../../dialog";

/**
 * 对组件应用包装器
 * @param component 原始组件
 * @param config 挂载配置
 * @returns 包装后的组件
 */
const applyWrapperToComponent = (
    component: VueComponent,
    config: VueComponentMountConfig
) => {
    // 配置提供了包装器函数则直接使用，因其承载调用方的自定义逻辑
    if (config.wrapper) {
        return config.wrapper(component);
    }

    // 仅有包装器配置则按配置创建高阶包装，统一处理 props/emit 与生命周期
    if (config.wrapperConfig) {
        return createComponentWrapper(component, config.wrapperConfig);
    }

    // 未提供任何包装策略时原样返回，保留组件默认行为
    return component;
};

/**
 * 合并组件数据与事件处理器为 setup 返回对象
 * @param config 挂载配置
 * @param context 可选的加载器上下文
 * @returns 合并后的 setup 返回对象
 */
const buildSetupReturnData = (
    config: VueComponentMountConfig,
    context?: VueComponentLoaderContext
) => {
    // 数据与事件处理器同属 setup 暴露面，先合并为统一对象供模板绑定
    const merged: Record<string, MergedSetupValue> = {
        ...(config.data || {}),
        ...(config.eventHandlers || {})
    };

    // 上下文提供跨组件的状态读写能力，作为可选项注入以避免污染无上下文调用方
    if (context) {
        merged.getState = context.getState;
        merged.setState = context.setState;
    }

    return merged;
};

/**
 * 调用挂载实例上指定的初始化方法
 * @param mountedInstance 已挂载的 Vue 实例
 * @param config 挂载配置
 * @param firstComponentName 默认模板对应的首个组件名
 */
const invokeInitMethod = (
    mountedInstance: ComponentPublicInstance | null | undefined,
    config: VueComponentMountConfig,
    firstComponentName: string | undefined
) => {
    // 显式指定初始化方法且实例具备 $refs 时才进入子组件引用读取流程，二者缺一即跳过
    if (!config.initMethodName || !hasVueRefs(mountedInstance)) {
        return;
    }
    // 守卫已收窄 mountedInstance 为含 $refs 的对象，直接读取模板引用表
    const refs = mountedInstance.$refs;
    const componentInstance: unknown = refs[`${firstComponentName}Component`];

    // 子组件暴露了目标方法才实际触发调用，避免运行时未定义函数报错
    if (hasInitMethod(componentInstance, config.initMethodName)) {
        // hasInitMethod 守卫已确认目标方法存在，但 noUncheckedIndexedAccess 使索引取值仍带 undefined，故用可选调用兜底
        componentInstance[config.initMethodName]?.(...(config.initMethodParams || []));
    }
};

/**
 * 创建 Vue 应用实例并挂载到指定容器
 * @param container DOM 容器元素
 * @param config Vue 组件挂载配置
 * @param context 可选的上下文对象，用于状态管理
 * @returns Vue 应用实例
 * @同步豁免: UI构建
 * @显式返回类型原因: 本工具作为通用挂载入口被多模块复用，固定返回 App 可让调用方在不读实现的情况下稳定获得类型与挂载能力
 */
export const createVueComponentLoader = (
    container: HTMLElement,
    config: VueComponentMountConfig,
    context?: VueComponentLoaderContext
): App => {
    // 对所有组件逐个应用包装器，得到可挂载的包装组件集合
    const wrappedComponents: Record<string, VueComponent> = {};
    for (const [name, component] of Object.entries(config.components)) {
        wrappedComponents[name] = applyWrapperToComponent(component, config);
    }

    // 取首个组件名作为默认模板，保证未显式传 template 时仍可渲染
    const firstComponentName = Object.keys(wrappedComponents)[0];

    // 以包装组件、setup 数据与模板构建应用实例
    const app = createApp({
        components: wrappedComponents,
        /**
         * setup 聚合组件数据、事件处理器与上下文状态方法为单一暴露面
         * 作用：把挂载配置中的 data/eventHandlers 与可选 context 的 getState/setState 合并返回，供模板绑定
         * 意图：保持挂载入口对配置与上下文的统一注入，避免各组件重复处理
         * 调用时机：createApp 内部渲染时由 Vue 调用
         */
        setup() {
            return buildSetupReturnData(config, context);
        },
        template: config.template || `<${firstComponentName} />`
    });

    // 挂载并执行挂载后初始化，捕获渲染异常以免中断外层流程
    try {
        const mountedInstance = app.mount(container);
        invokeInitMethod(mountedInstance, config, firstComponentName);
    } catch (e) {
        console.error("Vue组件挂载失败:", e);
    }
    return app;
};

/**
 * 在对话框中创建并挂载 Vue 组件
 * @param dialogInstance Dialog 实例，提供 element 以定位对话框主体
 * @param config Vue 组件挂载配置
 * @param context 可选的上下文对象，用于状态管理
 * @returns Vue 应用实例
 * @同步豁免: UI构建
 * @显式返回类型原因: 复用 createVueComponentLoader 的返回契约，调用方依赖固定的 App 类型来销毁与卸载
 */
export const createVueComponentInDialog = (
    dialogInstance: Dialog,
    config: VueComponentMountConfig,
    context?: VueComponentLoaderContext
): App => {
    // 从对话框元素中定位主体容器，Vue 应用将挂载于此；querySelector 返回 Element|null 需守卫收窄为 HTMLElement
    const dialogBody = dialogInstance.element.querySelector(".b3-dialog__body");

    // 未找到或不是 HTMLElement 说明对话框结构异常，抛错以暴露问题而非静默失败
    if (!isHTMLElement(dialogBody)) {
        console.error("无法找到对话框主体元素 .b3-dialog__body");
        throw new Error("无法找到对话框主体元素");
    }

    // 复用通用挂载流程完成对话框内 Vue 渲染
    return createVueComponentLoader(dialogBody, config, context);
};


/**
 * 创建带有包装器配置的 Vue 组件加载器
 * @param container DOM 容器元素
 * @param component Vue 组件
 * @param wrapperConfig 包装器配置
 * @param data 组件数据
 * @param eventHandlers 事件处理器
 * @param template 可选的模板字符串
 * @param initMethodName 可选的挂载后要调用的方法名
 * @param initMethodParams 可选的初始化方法参数
 * @returns Vue 应用实例
 * @同步豁免: UI构建
 * @显式返回类型原因: 作为便捷封装对外暴露固定 App 类型，便于调用方链式卸载与类型推断一致
 */
export const createWrappedVueComponentLoader = (
    container: HTMLElement,
    component: Component,
    wrapperConfig: ComponentWrapperConfig,
    data?: Record<string, unknown>,
    eventHandlers?: Record<string, ComponentEventHandler>,
    template?: string,
    initMethodName?: string,
    initMethodParams?: readonly unknown[]
): App => {
    const componentName = component.name || "DynamicComponent";

    return createVueComponentLoader(container, {
        components: { [componentName]: component },
        data,
        eventHandlers,
        template: template || `<${componentName} />`,
        initMethodName,
        initMethodParams,
        wrapperConfig
    });
};

/**
 * 创建带有自定义包装器的 Vue 组件加载器
 * @param container DOM 容器元素
 * @param component Vue 组件
 * @param wrapper 包装器函数
 * @param data 组件数据
 * @param eventHandlers 事件处理器
 * @param template 可选的模板字符串
 * @param initMethodName 可选的挂载后要调用的方法名
 * @param initMethodParams 可选的初始化方法参数
 * @returns Vue 应用实例
 * @同步豁免: UI构建
 * @显式返回类型原因: 作为便捷封装对外暴露固定 App 类型，便于调用方链式卸载与类型推断一致
 */
export const createCustomWrappedVueComponentLoader = (
    container: HTMLElement,
    component: Component,
    wrapper: ComponentWrapper,
    data?: Record<string, unknown>,
    eventHandlers?: Record<string, ComponentEventHandler>,
    template?: string,
    initMethodName?: string,
    initMethodParams?: readonly unknown[]
): App => {
    const componentName = component.name || "DynamicComponent";

    return createVueComponentLoader(container, {
        components: { [componentName]: component },
        data,
        eventHandlers,
        template: template || `<${componentName} />`,
        initMethodName,
        initMethodParams,
        wrapper
    });
};