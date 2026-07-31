/** Editor 的浮窗副本能力；布局宿主只通过 ILayoutTabFloatFactory 调用。 */
/** 用途：绑定 Editor 的运行时身份；使用范围：仅在完整 App 的编辑器浮窗工厂装配边界；解耦评估：运行时身份判断必须依赖具体 class，已限制在工厂而非布局核心。 */
import {Editor} from "./index";
/** 用途：复制编辑器页签；使用范围：浮窗创建阶段；解耦评估：复制行为由布局页签工厂集中维护，参数传递无法替代其完整状态迁移。 */
import {copyTab} from "../layout/tabUtil";
/** 用途：注册编辑器浮窗工厂；使用范围：完整 App 初始化；解耦评估：注册表隔离宿主与布局菜单，避免布局核心导入 Editor。 */
import {registerTabFloatFactory} from "../layout/tabFloat.registry";
/** 用途：声明浮窗工厂和副本句柄契约；使用范围：工厂装配与布局宿主边界；解耦评估：仅导入类型，不引入运行时实现。 */
import type {ILayoutTabFloatCopy, ILayoutTabFloatFactory} from "../layout/tabFloat.types";
/** 用途：校验临时页签运行时身份；使用范围：复制入口；解耦评估：Tab 是布局运行时句柄，不能由结构类型替代。 */
import {Tab} from "../layout/Tab";

registerTabFloatFactory({
    id: "editor",
    /** 作用：判断页签是否由 Editor 模型承载；意图：只为编辑器注册可复制浮窗；调用时机：布局浮窗入口筛选工厂。 */
    canCreate: (tab) => tab.model instanceof Editor,
    /** 作用：创建编辑器页签副本；意图：复用统一复制语义并保持原页签不变；调用时机：浮窗宿主准备临时页签。 */
    createTab: (source) => {
        if (!(source instanceof Tab)) {
            throw new Error("Editor tab float source is not a layout Tab");
        }
        return copyTab(source.model.app, source);
    },
    /** 作用：初始化副本并返回销毁句柄；意图：让浮窗宿主控制副本生命周期；调用时机：临时页签挂载到 Dialog 后。 @显式返回类型原因：固定浮窗宿主跨模块契约，避免返回对象推导随实现细节漂移。 */
    create: (_source, target): ILayoutTabFloatCopy => {
        // copyTab 已经集中维护 root/block/action/滚动位置兼容语义，
        // 这里仅触发既有初始化回调，不复制源编辑器 DOM 或可变状态。
        target.initialize();
        const model = target.model;
        if (!(model instanceof Editor)) {
            throw new Error("Editor tab float factory did not create an Editor model");
        }
        let disposed = false;
        return {
            /** 作用：释放编辑器副本；意图：同时清除底部反链资源和 Protyle；调用时机：浮窗关闭或初始化失败。 */
            dispose: () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                // The Editor model owns the optional bottom backlink panel;
                // dispose the model boundary rather than only its Protyle.
                model.destroy();
            },
        };
    },
} satisfies ILayoutTabFloatFactory);

/** 完整 App 静态入口加载此模块后，Editor 能力自动进入通用浮窗工厂注册表。 */
