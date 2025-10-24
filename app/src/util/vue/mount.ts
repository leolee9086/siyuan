import { createApp, App, Component } from "vue";

/**
 * Vue组件挂载配置接口
 */
export interface VueComponentMountConfig {
    /** 要注册的组件 */
    components: Record<string, Component>;
    /** 组件props数据 */
    data?: Record<string, any>;
    /** 事件处理器 */
    eventHandlers?: Record<string, Function>;
    /** 组件模板 */
    template?: string;
    /** 挂载后要调用的方法名 */
    initMethodName?: string;
    /** 初始化方法参数 */
    initMethodParams?: any[];
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
    // 创建Vue应用实例
    const app = createApp({
        components: config.components,
        setup() {
            // 合并数据和事件处理器
            const returnData: Record<string, any> = {
                ...config.data,
                ...config.eventHandlers
            };

            // 如果提供了上下文，添加上下文方法
            if (context) {
                returnData.getState = context.getState;
                returnData.setState = context.setState;
            }

            return returnData;
        },
        template: config.template || Object.keys(config.components)[0]
    });

    // 挂载到容器
    const mountedInstance = app.mount(container);

    // 如果指定了初始化方法，调用它
    if (config.initMethodName && (mountedInstance as any).$refs) {
        const componentName = Object.keys(config.components)[0];
        const componentRefName = `${componentName}Component`;
        const componentInstance = (mountedInstance as any).$refs[componentRefName];
        
        if (componentInstance && componentInstance[config.initMethodName]) {
            componentInstance[config.initMethodName](...(config.initMethodParams || []));
        }
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
    const container = document.createElement("div");
    
    // 将容器添加到对话框主体
    const dialogBody = dialogInstance.element.querySelector(".b3-dialog__body");
    if (dialogBody) {
        dialogBody.appendChild(container);
    }

    // 创建并挂载Vue应用
    return createVueComponentLoader(container, config, context);
};

/**
 * 创建简单的Vue组件加载器，适用于大多数场景
 * @param container DOM容器元素
 * @param component Vue组件
 * @param data 组件数据
 * @param eventHandlers 事件处理器
 * @param template 可选的模板字符串
 * @param initMethodName 可选的挂载后要调用的方法名
 * @param initMethodParams 可选的初始化方法参数
 * @returns Vue应用实例
 */
export const createSimpleVueComponentLoader = (
    container: HTMLElement,
    component: Component,
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
        initMethodParams
    });
};