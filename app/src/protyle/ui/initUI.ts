// S-forge: 模块化重构 - 将 UI 初始化逻辑拆分到独立模块
import { setEditMode } from "../util/setEditMode";
import { 初始化DOM结构 } from "./dom";
import { 绑定滚轮缩放事件, 绑定底部点击事件, 绑定悬停事件 } from "./event";
import {addLoading} from "./loading";

/**
 * 初始化 Protyle 编辑器的 UI
 * 包括 DOM 结构创建、事件绑定等
 * @同步豁免: UI构建 - 需要同步创建 DOM 结构并立即绑定事件，确保编辑器初始化的原子性
 */
export const initUI = (protyle: IProtyle) => {
    初始化DOM结构(protyle);
    addLoading(protyle);
    setEditMode(protyle, protyle.options.mode || "wysiwyg");
    document.execCommand("DefaultParagraphSeparator", false, "p");

    // S-forge: 模块化重构 - 事件绑定逻辑已拆分到 event.ts
    绑定滚轮缩放事件(protyle);
    绑定底部点击事件(protyle);
    绑定悬停事件(protyle);
};
