/** 用途：创建标准建议菜单；使用范围：Tiptap Composer 状态工厂；解耦评估：菜单实例必须在每个 Composer 的组合边界创建。 */
import {createProtyleMenu} from "./imports";
/** 用途：约束聚合交互状态；使用范围：状态工厂返回值。 */
import type {TiptapComposerInteractionState} from "./types";

/** @同步豁免: UI构建 挂载过程必须同步创建菜单和实例状态，异步化会破坏 ComposerHandle 契约。 */
/** 创建每个 Tiptap Composer 独占的可观察交互状态；菜单 DOM 仍由项目标准 Menu 管理。 @显式返回类型原因: 空数组和布尔初值需要按公共聚合状态扩宽。 */
export const createTiptapComposerInteractionState = (host: HTMLElement): TiptapComposerInteractionState => ({
    suggestion: {
        host,
        menu: createProtyleMenu(),
        open: false,
        selectedIndex: 0,
        items: [],
        command: null,
    },
    slash: {
        active: false,
        range: null,
        requestRevision: 0,
    },
    destroyed: false,
});
