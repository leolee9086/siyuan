import { setEditMode } from "../util/setEditMode";
import { 初始化DOM结构 } from "./dom";
import { 绑定滚轮缩放事件, 绑定底部点击事件, 绑定悬停事件 } from "./event";
import { addLoading, removeLoading } from "./loading";
import { setPadding, getPadding } from "./padding";

export { addLoading, removeLoading, setPadding, getPadding };

/**
 * 初始化 Protyle 编辑器的 UI
 * 包括 DOM 结构创建、事件绑定等
 */
export const initUI = (protyle: IProtyle) => {
    初始化DOM结构(protyle);
    addLoading(protyle);
    setEditMode(protyle, protyle.options.mode || "wysiwyg");
    document.execCommand("DefaultParagraphSeparator", false, "p");

    绑定滚轮缩放事件(protyle);
    绑定底部点击事件(protyle);
    绑定悬停事件(protyle);
};
