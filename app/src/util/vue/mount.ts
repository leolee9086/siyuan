import { createApp, App, Component, defineComponent, h } from "vue";
import { createComponentWrapper, type VueComponent, type ComponentWrapperConfig, type ComponentWrapper } from "./wrapper";

/**
 * Vue组件挂载配置接口
 */
export interface VueComponentMountConfig {
    /** 要注册的组件 */
    components: Record<string, Component>;
    /** 组件props数据 */
    data?: Record<string, any> | undefined;
    /** 事件处理器 */
    eventHandlers?: Record<string, Function> | undefined;
    /** 组件模板 */
    template?: string | undefined;
    /** 挂载后要调用的方法名 */
    initMethodName?: string | undefined;
    /** 初始化方法参数 */
    initMethodParams?: any[] | undefined;
    /** 组件包装器配置 */
    wrapperConfig?: ComponentWrapperConfig | undefined;
    /** 组件包装器函数 */
    wrapper?: ComponentWrapper | undefined;
}

/**
 * Vue组件加载器上下文
 */
export interface VueComponentLoaderContext {
    /** 获取状态 */
    getState<T = any>(key: string): T;
    /** 设置状态 */
    setState(key: string, value: any): void;
}

/**
 * 应用包装器到组件
 * @param component 原始组件
 * @param config 挂载配置
 * @returns 包装后的组件
 */
const applyWrapperToComponent = (
    component: VueComponent,
    config: VueComponentMountConfig
): VueComponent => {
    // 如果有包装器函数，优先使用包装器函数
    if (config.wrapper) {
        return config.wrapper(component);
    }
    
    // 如果有包装器配置，使用配置创建包装器
    if (config.wrapperConfig) {
        return createComponentWrapper(component, config.wrapperConfig);
    }
    
    // 否则返回原始组件
    return component;
};

/**
 * 创建Vue应用实例并挂载到指定容器
 * @param container DOM容器元素
 * @param config Vue组件挂载配置
 * @param context 可选的上下文对象，用于状态管理
 * @returns Vue应用实例
 */
export const createVueComponentLoader = (
    container: HTMLElement,
    config: VueComponentMountConfig,
    context?: VueComponentLoaderContext
): App => {
    // 应用包装器到所有组件
    const wrappedComponents: Record<string, VueComponent> = {};
    Object.entries(config.components).forEach(([name, component]) => {
        wrappedComponents[name] = applyWrapperToComponent(component , config);
    });

    // 获取第一个组件名作为默认模板
    const firstComponentName = Object.keys(wrappedComponents)[0];

    // 创建Vue应用实例
    const app = createApp({
        components: wrappedComponents,
        setup() {
            // 合并数据和事件处理器
            const returnData: Record<string, any> = {
                ...(config.data || {}),
                ...(config.eventHandlers || {})
            };

            // 如果提供了上下文，添加上下文方法
            if (context) {
                returnData.getState = context.getState;
                returnData.setState = context.setState;
            }

            return returnData;
        },
        template: config.template || `<${firstComponentName} />`
    });

    // 挂载到容器
    try {
        const mountedInstance = app.mount(container);
        // 如果指定了初始化方法，调用它
        if (config.initMethodName && (mountedInstance as any).$refs) {
            const componentRefName = `${firstComponentName}Component`;
            const componentInstance = (mountedInstance as any).$refs[componentRefName];

            if (componentInstance && componentInstance[config.initMethodName]) {
                componentInstance[config.initMethodName](...(config.initMethodParams || []));
            }
        }
    } catch (e) {
        console.error('Vue组件挂载失败:', e);
    }
    return app;
};

/**
 * 在对话框中创建并挂载Vue组件
 * @param dialogInstance Dialog实例
 * @param config Vue组件挂载配置
 * @param context 可选的上下文对象，用于状态管理
 * @returns Vue应用实例
 */
export const createVueComponentInDialog = (
    dialogInstance: any,
    config: VueComponentMountConfig,
    context?: VueComponentLoaderContext
): App => {
    // 创建容器元素
    // 将容器添加到对话框主体
    const dialogBody = dialogInstance.element.querySelector(".b3-dialog__body");

    // 确保找到了对话框主体元素
    if (!dialogBody) {
        console.error("无法找到对话框主体元素 .b3-dialog__body");
        throw new Error("无法找到对话框主体元素");
    }

    // 创建并挂载Vue应用
    return createVueComponentLoader(dialogBody, config, context);
};


/**
 * 创建带有包装器的Vue组件加载器
 * @param container DOM容器元素
 * @param component Vue组件
 * @param wrapperConfig 包装器配置
 * @param data 组件数据
 * @param eventHandlers 事件处理器
 * @param template 可选的模板字符串
 * @param initMethodName 可选的挂载后要调用的方法名
 * @param initMethodParams 可选的初始化方法参数
 * @returns Vue应用实例
 */
export const createWrappedVueComponentLoader = (
    container: HTMLElement,
    component: Component,
    wrapperConfig: ComponentWrapperConfig,
    data?: Record<string, any>,
    eventHandlers?: Record<string, Function>,
    template?: string,
    initMethodName?: string,
    initMethodParams?: any[]
): App => {
    const componentName = component.name || 'DynamicComponent';

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
 * 创建带有自定义包装器的Vue组件加载器
 * @param container DOM容器元素
 * @param component Vue组件
 * @param wrapper 包装器函数
 * @param data 组件数据
 * @param eventHandlers 事件处理器
 * @param template 可选的模板字符串
 * @param initMethodName 可选的挂载后要调用的方法名
 * @param initMethodParams 可选的初始化方法参数
 * @returns Vue应用实例
 */
export const createCustomWrappedVueComponentLoader = (
    container: HTMLElement,
    component: Component,
    wrapper: ComponentWrapper,
    data?: Record<string, any>,
    eventHandlers?: Record<string, Function>,
    template?: string,
    initMethodName?: string,
    initMethodParams?: any[]
): App => {
    const componentName = component.name || 'DynamicComponent';

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