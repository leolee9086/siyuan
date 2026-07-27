/** 用途：活动页签查询；使用范围：布局快捷键、文件创建和插件 API；解耦评估：只依赖完整 LayoutTab 与无状态布局查询，不加载 Tab class 或页签构造实现。 */
import type {LayoutTab} from "./imports";
/** 用途：读取中心布局页签；使用范围：定位当前焦点页签；解耦评估：复用既有 getAllTabs 唯一遍历实现，不复制布局树算法。 */
import {getAllTabs} from "./imports";

/**
 * 获取当前活动页签。
 * 作用：从 DOM 焦点标识解析当前页签，并在允许时回退到布局中的任一焦点页签。
 * 意图：将无状态查询从 tabUtil 综合模块中分离，避免文件创建流程加载页签构造器。
 * 调用时机：快捷键、文件创建和插件查询当前页签时同步调用。
 * @显式返回类型原因：查询结果必须固定为完整 LayoutTab 领域根，避免具体 Tab 实现类型从调用方重新进入依赖图。
 * @同步豁免: 需要绝对同步的DOM访问 - 调用方在当前事件栈内立即读取并操作活动页签。
 */
export const getActiveTab = (wndActive = true): LayoutTab | undefined => {
    const activeTabElement = document.querySelector(".layout__wnd--active .item--focus");
    const activeTabId = activeTabElement?.getAttribute("data-id");
    let tab = activeTabId ? getAllTabs().find((item) => item.id === activeTabId) : undefined;
    // 关闭窗口焦点或 DOM 尚未更新时，允许从布局快照寻找备用焦点页签。
    if (!tab && !wndActive) {
        tab = getAllTabs().find((item) => item.headElement?.classList.contains("item--focus"));
    }
    return tab;
};
