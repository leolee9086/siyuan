/** Editor 的浮窗副本能力；布局宿主只通过 ILayoutTabFloatFactory 调用。 */
import {Editor} from "./index";
import {copyTab} from "../layout/tabUtil";
import {registerTabFloatFactory} from "../layout/tabFloat.registry";
import type {ILayoutTabFloatCopy, ILayoutTabFloatFactory} from "../layout/tabFloat.types";

const editorTabFloatFactory: ILayoutTabFloatFactory = {
    id: "editor",
    canCreate: (tab) => tab.model instanceof Editor,
    createTab: (source) => copyTab(source.model.app, source),
    create: (_source, target): ILayoutTabFloatCopy => {
        // copyTab 已经集中维护 root/block/action/滚动位置兼容语义，
        // 这里仅触发既有初始化回调，不复制源编辑器 DOM 或可变状态。
        target.callback?.(target);
        const model = target.model;
        if (!(model instanceof Editor)) {
            throw new Error("Editor tab float factory did not create an Editor model");
        }
        let disposed = false;
        return {
            dispose: () => {
                if (disposed) {
                    return;
                }
                disposed = true;
                model.editor?.destroy();
            },
        };
    },
};

/** 完整 App 静态入口加载此模块后，Editor 能力自动进入通用浮窗工厂注册表。 */
registerTabFloatFactory(editorTabFloatFactory);
