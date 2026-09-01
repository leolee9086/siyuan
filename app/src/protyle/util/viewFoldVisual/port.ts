/** 用途：读取视图折叠视觉能力的 Symbol 注册表。使用范围：异步标题加载后的渲染。解耦评估：环境模块持有跨调用状态，端口自身无状态。 */
import {getRegisteredViewFoldVisualEffects} from "./registry.environment";
/** 用途：写入视图折叠视觉能力的 Symbol 注册表。使用范围：Protyle 视觉组合初始化。解耦评估：环境模块持有跨调用状态，端口自身无状态。 */
import {registerViewFoldVisualEffects} from "./registry.environment";
/** 用途：描述标题加载后的视觉能力。使用范围：端口注册参数和 no-op 回退。解耦评估：纯类型不加载渲染实现。 */
import type {TViewFoldVisualEffects} from "./types";

/** 作用：忽略未注册宿主的标题子块渲染。意图：独立入口可加载折叠状态而不加载完整编辑器渲染。调用时机：视觉端口未注册时。 */
function ignoreHeadingChildren(protyle: IProtyle, children: Element[]) {
    void protyle;
    void children;
    return undefined;
}

/** 作用：忽略未注册宿主的禁用态同步。意图：独立入口可加载折叠状态而不加载编辑器禁用逻辑。调用时机：视觉端口未注册时。 */
function ignoreDisabledState(protyle: IProtyle) {
    void protyle;
    return undefined;
}

/** 作用：创建未注册宿主时的 no-op 视觉能力。意图：独立入口可加载折叠状态而不引入渲染实现。调用时机：注册表为空时。 */
const createFallbackEffects = () => ({
    renderHeadingChildren: ignoreHeadingChildren,
    applyDisabledState: ignoreDisabledState,
});

/**
 * 作用：读取当前视图折叠视觉能力。
 * 意图：将低层折叠状态与 AV、块渲染和禁用态保持单向隔离。
 * 调用时机：异步标题子块插入完成后。
 * @同步豁免: 生命周期 - 当前 DOM 插入完成后必须在同一调用栈获得渲染能力或 no-op 回退。
 */
export const getViewFoldVisualEffects = () => getRegisteredViewFoldVisualEffects() || createFallbackEffects();

/**
 * 作用：注册视图折叠的视觉实现。
 * 意图：由 Protyle 组合层拥有高层渲染依赖。
 * 调用时机：Protyle 视觉效果模块初始化。
 * @同步豁免: 生命周期 - 模块初始化必须在首个标题异步加载前同步固定当前函数引用。
 */
export const setViewFoldVisualEffects = (nextEffects: TViewFoldVisualEffects) => {
    const effects = {
        renderHeadingChildren: nextEffects.renderHeadingChildren,
        applyDisabledState: nextEffects.applyDisabledState,
    };
    registerViewFoldVisualEffects(effects);
};
