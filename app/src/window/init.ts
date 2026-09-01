import { Constants } from "../constants";
import { ipcSend } from "../platform/electron/ipcRenderer";
import { setZoomFactor } from "../platform/electron/webFrame";
import { fetchPost } from "../util/network/fetch";
import { adjustLayout, getInstanceById } from "../layout/util";
/** 用途：恢复窗口中心布局的 JSON 实例；使用范围：窗口初始化阶段；解耦评估：反序列化必须保留具体布局构造边界，调用方只依赖其公开函数，不通过 layout/util 转发。 */
import {JSONToCenter} from "../layout/layout-deserialization";
import {resizeTabs} from "../layout/resize/resizeTabs";
import {setTabPosition} from "./setHeader";
import { initStatus } from "../layout/status";
import { appearanceConfigApi } from "../config/tabs/appearanceRuntime";
import { initAssets, setInlineStyle } from "../util/assets/assets";
import { renderSnippet } from "../config/util/snippets";
import { getSearch } from "../util/platform/functions";
import { initWindow } from "../boot/onGetConfig";
import type { AppFacade } from "../app/AppFacade.types";
import { afterLayoutReady } from "../plugin/loader";
import { initWindowEvent } from "../boot/globalEvent/event";
import { getSiyuanConfig, getSiyuanLayout, getSiyuanStorage, setSiyuanEmojis, setSiyuanLayoutCenterLayout } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
import { windowAddEventListener, clearTimeout, setTimeout } from "../util/siyuanEnvironments/windowTimer.environment";
import { getAllEditor } from "../layout/getAll";
import { isEmojiArray, isTab } from "./init.guard";
import {initNativeDialogOverride} from "../protyle/util/compatibility";
import {initWindowOpenOverride} from "../editor/openLink";
import { isElectron } from "../platform";

/** 处理获取Emoji配置的响应 */
const handleEmojiConfResponse = (app: AppFacade, response: IWebSocketData) => {
    // 验证响应数据格式正确性：确保返回的是有效的emoji数组后再设置
    // 防御性检查，防止服务器返回异常格式导致后续渲染出错
    if (isEmojiArray(response.data)) {
        setSiyuanEmojis(response.data);
    }

    const layout = JSON.parse(sessionStorage.getItem("layout") || "{}");
    if (layout.layout) {
        JSONToCenter(app, layout.layout);
        setSiyuanLayoutCenterLayout(getSiyuanLayout().layout);
        afterLayout(app);
        return;
    }
    const tabsJSON = JSON.parse(getSearch("json") || "[]");
    const lastTab = tabsJSON[tabsJSON.length - 1];
    lastTab.active = true;
    JSONToCenter(app, {
        direction: "lr",
        resize: "lr",
        size: "auto",
        type: "center",
        instance: "Layout",
        children: [{
            instance: "Wnd",
            children: tabsJSON
        }]
    });
    setSiyuanLayoutCenterLayout(getSiyuanLayout().layout);
    adjustLayout(getSiyuanLayout().centerLayout);
    afterLayout(app);
};

/** 执行resize布局调整 */
const resize = () => {
    adjustLayout(getSiyuanLayout().centerLayout);
    resizeTabs();
    // S-forge: 上游改进 - 防止菜单超出窗口边界 (#15400)
    window.siyuan.menus.menu.resetPosition();
    const selection = getSelection();
    // 检查是否存在有效的文本选择：仅在用户有选区时才重新定位工具栏
    // 避免无选区时进行不必要的DOM操作
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        for (const item of getAllEditor()) {
            // 仅重绘包含当前选区的编辑器工具栏，避免其他页签使用无关 Range 定位。
            if (item.protyle.wysiwyg?.element.contains(range.startContainer)) {
                item.protyle.toolbar?.render(item.protyle, range);
            }
        }
    }
    for (const item of window.siyuan.dialogs) {
        item.resize();
    }
};

/**
 * 处理窗口resize事件
 *
 * 使用防抖策略避免resize过程中频繁触发布局计算
 */
const handleWindowResize = (resizeTimeoutRef: { value: number }) => {
    clearTimeout(resizeTimeoutRef.value);
    // setTimeout用于防抖：窗口resize事件会高频触发（每帧多次），
    // 无法使用确定性方案（如ResizeObserver）因为需要等待用户停止拖拽后再执行布局计算，
    // 延迟时间Constants.TIMEOUT_RESIZE由项目统一配置，平衡响应速度与性能开销
    resizeTimeoutRef.value = setTimeout(resize, Constants.TIMEOUT_RESIZE);
};

/**
 * 初始化应用窗口
 *
 * 作用：完成窗口启动所需的所有初始化工作，包括UI缩放、事件绑定、配置加载等
 *
 * 意图：这是应用启动的核心入口，将原本分散的初始化逻辑集中管理，确保启动顺序正确
 *
 * 调用时机：在应用启动时，获取到基础配置后调用（通常在onGetConfig之后）
 *
 * 问题/改进：
 * - 目前包含大量同步初始化调用，启动时间较长时可考虑懒加载部分资源
 * - emoji配置获取是异步的，但其他初始化可能依赖其结果，后续可考虑Promise.all优化
 *
 * 返回值：上游引入的 layoutReady Promise —— 在 emoji 配置响应、布局恢复与 afterLayout
 * 后处理全部完成后 resolve；调用方可 await 本函数以保证启动序列顺序。
 *
 * @param app - 应用实例
 */
export const init = async (app: AppFacade): Promise<void> => {
    const storage = getSiyuanStorage();
    setZoomFactor(storage[Constants.LOCAL_ZOOM]);
    const position = Constants.SIZE_ZOOM.find((item) => item.zoom === storage[Constants.LOCAL_ZOOM])?.position;
    ipcSend(Constants.SIYUAN_CMD, {
        cmd: "setTrafficLightPosition",
        zoom: storage[Constants.LOCAL_ZOOM],
        position
    });
    initWindowEvent(app);
    // 上游改进：把 emoji 配置请求包进 layoutReady Promise，布局就绪前 init 不会完成；
    // 响应处理仍走本地抽取的 handleEmojiConfResponse，保持防御式校验不被绕过。
    const layoutReady = new Promise<void>((resolve) => {
        fetchPost("/api/system/getEmojiConf", {}, response => {
            handleEmojiConfResponse(app, response);
            resolve();
        });
    });
    initStatus(true);
    initWindow(app);
    initWindowOpenOverride(app);
    // S-forge: 仅桌面端覆盖原生对话框行为
    if (isElectron) {
        initNativeDialogOverride();
    }
    appearanceConfigApi.apply(getSiyuanConfig().appearance);
    initAssets();
    setInlineStyle();
    renderSnippet();
    // S-forge: 本地重构 - 使用独立函数处理resize事件
    // S-forge: 上游改进 - 已应用菜单位置重置到重构后的resize函数中
    const resizeTimeoutRef = { value: 0 };
    windowAddEventListener("resize", () => handleWindowResize(resizeTimeoutRef));
    return layoutReady;
};

/**
 * 布局加载完成后执行的后处理操作
 *
 * 作用：在布局初始化完成后，激活插件和恢复标签页状态
 *
 * 意图：将布局完成后的额外处理逻辑抽离，避免与布局初始化代码耦合
 *
 * 调用时机：由handleEmojiConfResponse在布局加载完成后调用
 *
 * 问题/改进：
 * - 当前通过sessionStorage传递布局数据，可改用更明确的状态管理
 * - plugin激活和tab切换可考虑并行执行优化性能
 *
 * @param app - 应用实例
 */
const afterLayout = (app: AppFacade) => {
    afterLayoutReady(app);
    const tabHeaders = document.querySelectorAll<HTMLLIElement>('li[data-type="tab-header"][data-init-active="true"]');
    for (const item of tabHeaders) {
        const tab = getInstanceById(item.getAttribute("data-id") || "");
        // 类型守卫检查：确保获取的实例确实是Tab类型
        // querySelector返回的是DOM元素，需要通过getInstanceById获取对应的数据模型实例
        if (isTab(tab)) {
            tab.parent.switchTab(item, false, false);
        }
    }
    // 标签位置依赖布局 Dock 的统一 CSS 过渡结束；该过渡没有单一 DOM 事件源，使用与样式一致的全局时长。
    setTimeout(() => {
        setTabPosition();
    }, Constants.TIMEOUT_TRANSITION);
};
