/** 用途：完整布局容器、窗口和页签领域根。使用范围：递归序列化布局树；解耦评估：纯类型依赖不加载具体 class。 */
import type {LayoutDomain} from "./imports";
/** 用途：完整布局页签领域根。使用范围：页签模型序列化；解耦评估：纯类型依赖不加载具体 Tab。 */
import type {LayoutTab} from "./imports";
/** 用途：完整布局窗口领域根。使用范围：窗口子树序列化；解耦评估：纯类型依赖不加载具体 Wnd。 */
import type {LayoutWindow} from "./imports";
/** 用途：布局领域守卫。使用范围：按完整容器身份分派子节点；解耦评估：稳定抽象身份替代具体 class 判断。 */
import {isLayoutDomain} from "./imports";
/** 用途：页签领域守卫。使用范围：分派页签子模型；解耦评估：稳定抽象身份替代 class。 */
import {isLayoutTab} from "./imports";
/** 用途：窗口领域守卫。使用范围：分派窗口子树；解耦评估：稳定抽象身份替代 class。 */
import {isLayoutWindow} from "./imports";
/** 用途：布局模型根。使用范围：页签模型序列化输入；解耦评估：稳定生命周期契约。 */
import type {ILayoutModel} from "./imports";
/** 用途：实例字段序列化。使用范围：递归前写入当前节点；解耦评估：同一持久化领域的模型分派实现。 */
import {serializeInstance} from "./imports";
/** 用途：布局 JSON 与中断状态。使用范围：保持既有持久化协议；解耦评估：纯数据类型。 */
import type {BreakObject} from "./imports";
/** 用途：布局 JSON。使用范围：递归输出对象；解耦评估：纯数据类型。 */
import type {SerializationJSON} from "./imports";

/** 序列化布局容器或窗口的有序子节点。 */
const serializeContainerChildren = (
    layout: LayoutDomain | LayoutWindow,
    json: SerializationJSON,
    breakObj?: BreakObject,
) => {
    const isEdgeLayout = isLayoutDomain(layout) &&
        (layout.type === "bottom" || layout.type === "left" || layout.type === "right");
    if (isEdgeLayout) {
        json.children = [
            {instance: "Wnd", children: []},
            {instance: "Wnd", resize: layout.type === "bottom" ? "lr" : "tb", children: []},
        ];
        return;
    }
    const children: SerializationJSON[] = [];
    json.children = children;
    for (const child of layout.children) {
        const childJSON: SerializationJSON = {};
        children.push(childJSON);
        layoutToJSON(child, childJSON, breakObj);
    }
};

/** 序列化页签模型；尚未初始化时保留原始 initdata。 */
const serializeTabChildren = (layout: LayoutTab, json: SerializationJSON, breakObj?: BreakObject) => {
    if (layout.model) {
        const childJSON: SerializationJSON = {};
        json.children = childJSON;
        layoutToJSON(layout.model, childJSON, breakObj);
        return;
    }
    json.children = layout.headElement ?
        JSON.parse(layout.headElement.getAttribute("data-initdata") || "{}") : {};
};

/** 将一个完整布局节点递归写入既有布局 JSON 协议。 @同步豁免: UI构建 */
export const layoutToJSON = (
    layout: LayoutDomain | LayoutWindow | LayoutTab | ILayoutModel,
    json: SerializationJSON,
    breakObj?: BreakObject,
) => {
    serializeInstance(layout, json, breakObj);
    // 布局容器与窗口按 children 顺序递归，模型节点没有布局子树。
    if (isLayoutDomain(layout) || isLayoutWindow(layout)) {
        serializeContainerChildren(layout, json, breakObj);
        return;
    }
    // 页签只序列化其挂载模型或尚未初始化的原始数据。
    if (isLayoutTab(layout)) {
        serializeTabChildren(layout, json, breakObj);
    }
};
