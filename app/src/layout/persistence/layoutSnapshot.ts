/** 用途：序列化 Dock DOM 状态。使用范围：构造完整布局快照；解耦评估：依赖完整 DockDomain 的同层持久化实现。 */
import {dockToJSON} from "./imports";
/** 用途：读取当前布局。使用范围：主窗口与独立窗口快照；解耦评估：无参快照 API 的既有环境语义。 */
import {getSiyuanLayout} from "./imports";
/** 用途：递归序列化布局树。使用范围：快照的 layout 字段；解耦评估：同一持久化领域的唯一算法。 */
import {layoutToJSON} from "./layoutSerializer";
/** 用途：快照 JSON 与中断状态。使用范围：保存和导出共享协议；解耦评估：纯数据类型。 */
import type {BreakObject} from "./imports";
/** 用途：布局 JSON。使用范围：快照输出；解耦评估：纯数据类型。 */
import type {SerializationJSON} from "./imports";

/** 构建包含三个 Dock 的主窗口快照骨架。 @同步豁免: 需要绝对同步的DOM访问 */
export const buildMainWindowLayoutJSON = () => {
    const useElement = document.querySelector("#barDock use");
    const layout = getSiyuanLayout();
    if (!useElement || !layout?.bottomDock || !layout.leftDock || !layout.rightDock) {
        return null;
    }
    return {
        hideDock: useElement.getAttribute("xlink:href") === "#iconDock",
        layout: {},
        bottom: dockToJSON(layout.bottomDock),
        left: dockToJSON(layout.leftDock),
        right: dockToJSON(layout.rightDock),
    } satisfies SerializationJSON;
};

/** 构建独立窗口布局快照。 @同步豁免: UI构建 */
export const serializeWindowModeLayout = (breakObj?: BreakObject) => {
    const result: SerializationJSON = {layout: {}};
    const layout = getSiyuanLayout()?.layout;
    if (layout) {
        const data: SerializationJSON = {};
        result.layout = data;
        layoutToJSON(layout, data, breakObj);
    }
    return result;
};

/** 获取包含 Dock 与主布局的当前完整快照。 @同步豁免: UI构建 */
export const getAllLayout = () => {
    const layout = getSiyuanLayout();
    const result: SerializationJSON = {
        hideDock: (() => {
            const useElement = document.querySelector("#barDock use");
            return useElement?.getAttribute("xlink:href") === "#iconDock";
        })(),
        layout: {},
        bottom: layout?.bottomDock ? dockToJSON(layout.bottomDock) : undefined,
        left: layout?.leftDock ? dockToJSON(layout.leftDock) : undefined,
        right: layout?.rightDock ? dockToJSON(layout.rightDock) : undefined,
    };
    // 主布局已经初始化时才填充布局树，启动早期仍返回 Dock 快照骨架。
    if (layout?.layout) {
        const data: SerializationJSON = {};
        result.layout = data;
        layoutToJSON(layout.layout, data);
    }
    return result;
};
