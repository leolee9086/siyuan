/** 用途：编辑器网络请求、字体事件和 Protyle 查询；使用范围：颜色应用与持久化；解耦评估：通过颜色模块网关集中依赖，业务逻辑不直接绑定基础实现。 */
import {fetchPost, fontEvent, hasClosestBlock, 查找Protyle, 查找有选区的Protyle} from "./imports";
/** 用途：颜色应用模式和清除范围类型；使用范围：块样式、文字样式及清除操作；解耦评估：纯类型依赖。 */
import type {ClearScope, ColorMode, RGB} from "./types";
/** 用途：把 RGB 转为编辑器可接受的 CSS 颜色；使用范围：applyRgbColor；解耦评估：颜色格式转换与编辑器操作分离。 */
import {rgbToCss} from "./colorEngine";

/** 获取当前 Protyle 中明确选中的块。 */
const getSelectedBlocks = (protyle: IProtyle) => Array.from(
    protyle.wysiwyg.element.querySelectorAll<HTMLElement>("[data-node-id].protyle-wysiwyg--select"),
);

/** 从当前文字选区找到所属块，供无选区时的块颜色操作使用。 */
const getCurrentBlock = () => {
    const node = window.getSelection()?.anchorNode;
    const block = node ? hasClosestBlock(node) : false;
    return block instanceof HTMLElement ? block : null;
};

/** 把块的当前 style 属性持久化到内核，发布和只读状态直接跳过。 */
const persistBlockStyle = (element: HTMLElement) => {
    const id = element.getAttribute("data-node-id");
    if (!id || window.siyuan.config.readonly || window.siyuan.isPublish) {
        return;
    }
    fetchPost("/api/attr/setBlockAttrs", {
        id,
        attrs: {style: element.getAttribute("style") || ""},
    });
};

/** 按目标模式写入块的前景色、背景色或两者。 */
const applyBlockStyle = (elements: HTMLElement[], mode: ColorMode, color: string) => {
    for (const element of elements) {
        if (mode === "color" || mode === "style1") {
            element.style.color = color;
        }
        if (mode === "backgroundColor" || mode === "style1") {
            element.style.backgroundColor = color;
            element.style.setProperty("--b3-parent-background", color);
        }
        persistBlockStyle(element);
    }
};

/** 根据编辑器选区优先级返回应该执行颜色操作的 Protyle 实例。 */
const getProtylesForAction = () => {
    const selected = 查找有选区的Protyle();
    if (selected.length > 0) {
        return selected;
    }
    const current = getCurrentBlock();
    const protyle = 查找Protyle(current);
    return protyle ? [protyle] : [];
};

/** 将颜色应用到文字选区；没有文字选区时回退到当前或选中的块。 */
export const applyColorToSelection = (mode: ColorMode, color: string) => {
    const protyles = getProtylesForAction();
    let applied = false;
    for (const protyle of protyles) {
        const range = protyle.toolbar.range;
        if (range && !range.collapsed) {
            const inlineColor = mode === "style1" ? `${color}\u200B${color}` : color;
            fontEvent(protyle, [], mode, inlineColor);
            applied = true;
            continue;
        }
        const selectedBlocks = getSelectedBlocks(protyle);
        const currentBlock = getCurrentBlock();
        const targets = selectedBlocks.length > 0 ? selectedBlocks : currentBlock ? [currentBlock] : [];
        if (targets.length === 0) {
            continue;
        }
        applyBlockStyle(targets, mode, color);
        applied = true;
    }
    return applied;
};

/** 将 RGB 颜色应用到当前编辑器目标，并按 alpha 生成 CSS 值。 */
export const applyRgbColor = (mode: ColorMode, color: RGB, alpha = 1) => applyColorToSelection(mode, rgbToCss(color, alpha));

/** 获取当前已加载的块元素，供批量清除颜色使用。 */
const getLoadedBlocks = () => Array.from(document.querySelectorAll<HTMLElement>(
    ".protyle-wysiwyg.protyle-wysiwyg--attr [data-node-id]",
));

/** 按视口过滤已加载块，避免“可见块”操作修改屏幕外内容。 */
const getVisibleBlocks = () => getLoadedBlocks().filter(element => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0;
});

/** 获取所有 Protyle 中的选中块。 */
const getSelectedBlocksFromAllProtyles = () => 查找有选区的Protyle().flatMap(getSelectedBlocks);

/** 清除单个块的前景或背景颜色，并保留其它 style 属性。 */
const clearBlockElementColor = (element: HTMLElement, mode: "color" | "backgroundColor") => {
    if (mode === "color") {
        element.style.color = "";
        persistBlockStyle(element);
        return;
    }
    element.style.backgroundColor = "";
    element.style.removeProperty("--b3-parent-background");
    persistBlockStyle(element);
};

/** 按选中、可见或已加载范围批量清除块颜色。 */
export const clearBlockColors = (mode: "color" | "backgroundColor", scope: ClearScope) => {
    const targets = scope === "selected" ? getSelectedBlocksFromAllProtyles() : scope === "visible" ? getVisibleBlocks() : getLoadedBlocks();
    for (const element of targets) {
        clearBlockElementColor(element, mode);
    }
    return targets.length;
};

/** 清除当前文字选区中的前景或背景行内样式。 */
export const clearInlineTextColor = (mode: "color" | "backgroundColor") => {
    const protyles = getProtylesForAction();
    let applied = false;
    for (const protyle of protyles) {
        if (!protyle.toolbar.range || protyle.toolbar.range.collapsed) {
            continue;
        }
        fontEvent(protyle, [], mode, "");
        applied = true;
    }
    return applied;
};
