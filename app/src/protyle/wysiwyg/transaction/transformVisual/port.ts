/** 用途：读取转换视觉能力的 Symbol 注册表。使用范围：转换命令回放与刷新。解耦评估：环境模块持有跨调用状态，端口自身无状态。 */
import {getRegisteredTransactionTransformVisualEffects} from "./registry.environment";
/** 用途：写入转换视觉能力的 Symbol 注册表。使用范围：Protyle 视觉组合初始化。解耦评估：环境模块持有跨调用状态，端口自身无状态。 */
import {registerTransactionTransformVisualEffects} from "./registry.environment";
/** 用途：描述视觉回放与刷新能力。使用范围：端口注册参数和 no-op 回退。解耦评估：纯类型不加载渲染实现。 */
import type {TTransactionTransformVisualEffects} from "./types";

/** 作用：忽略未注册宿主的操作回放。意图：独立入口可加载命令而不加载渲染。调用时机：视觉端口未注册时。 */
function ignoreOperations(protyle: IProtyle, operations: IOperation[], isUndo: boolean) {
    void protyle;
    void operations;
    void isUndo;
    return undefined;
}

/** 作用：忽略未注册宿主的视觉刷新。意图：独立入口可加载命令而不加载渲染。调用时机：视觉端口未注册时。 */
function ignoreRerender(protyle: IProtyle) {
    void protyle;
    return undefined;
}

/** 作用：忽略未注册宿主的单块渲染。意图：独立入口可加载容器转换而不加载块渲染。调用时机：视觉端口未注册时。 */
function ignoreRenderBlock(protyle: IProtyle, element: Element) {
    void protyle;
    void element;
    return undefined;
}

/** 作用：忽略未注册宿主的已转换块渲染。意图：独立入口可加载转换命令而不加载渲染。调用时机：视觉端口未注册时。 */
function ignoreConvertedBlocks(protyle: IProtyle) {
    void protyle;
    return undefined;
}

/** 作用：创建未注册宿主时的 no-op 视觉能力。意图：独立入口可加载转换命令而不引入渲染实现。调用时机：注册表为空时。 */
const createFallbackEffects = () => ({
    applyOperations: ignoreOperations,
    rerender: ignoreRerender,
    renderBlock: ignoreRenderBlock,
    renderConvertedBlocks: ignoreConvertedBlocks,
});

/**
 * 作用：读取当前转换视觉能力。
 * 意图：将低层命令与事务回放、AV 渲染及高亮渲染保持单向隔离。
 * 调用时机：列表、空段落和块转换提交后。
 * @同步豁免: 生命周期 - 当前输入事务必须在同一事件栈中取得回放能力或 no-op 回退。
 */
export const getTransactionTransformVisualEffects = () => {
    return getRegisteredTransactionTransformVisualEffects() || createFallbackEffects();
};

/**
 * 作用：注册事务转换的视觉实现。
 * 意图：由回放层拥有渲染依赖。
 * 调用时机：Protyle 视觉效果模块初始化。
 * @同步豁免: 生命周期 - 模块初始化必须在首个转换命令前同步固定当前函数引用。
 */
export const setTransactionTransformVisualEffects = (nextEffects: TTransactionTransformVisualEffects) => {
    const effects = {
        applyOperations: nextEffects.applyOperations,
        rerender: nextEffects.rerender,
        renderBlock: nextEffects.renderBlock,
        renderConvertedBlocks: nextEffects.renderConvertedBlocks,
    };
    registerTransactionTransformVisualEffects(effects);
};
