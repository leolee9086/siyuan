import { confirmDialog } from "../dialog/confirmDialog";
import { Plugin } from "./index";
import { hideMessage, showMessage } from "../dialog/message";
import { Dialog } from "../dialog";
import { fetchGet, fetchPost, fetchSyncPost } from "../util/network/fetch";
import { getBackend, getFrontend, isMobile } from "../util/platform/functions";
import { saveExportFile, updateHotkeyTip } from "../protyle/util/compatibility";
import * as platformUtils from "./platformUtils";
import { Constants } from "../constants";
import { Setting } from "./Setting";
import { Menu } from "./Menu";
import { Protyle } from "../protyle";
import ProtyleMethod from "../protyle/method";
import { getSForgeState } from "../config/sforge.global";
import { SForgeSymbols } from "../config/sforge.symbols";
import { isMobileFileOpenPort } from "./api/openMobileFile.guard";
/** 用途：提供插件 API 的应用抽象外观；使用范围：移动文件入口参数；解耦评估：type-only 依赖，不加载完整应用入口。 */
import type {AppFacade} from "../app/AppFacade.types";
import type {SettingTabId} from "../config/setting/setting.types";
import { getMobileEditor, getMobilePopEditor } from "./API.environment";
import { isHTMLElement } from "../util/DOM/element.guard";
import { exitSiYuan } from "../dialog/processSystem";
import { lockScreen } from "../dialog/processSystem/lockScreen";
import { getActiveTab } from "../layout/tabUtil";
import { getAllModels, getAllTabs } from "../layout/getAll";
import { getAllEditor } from "../layout/getAll";
import {openAttr} from "../menus/commonMenuItem/fileAttr/openAttr";
import {openFileAttr} from "../menus/commonMenuItem/fileAttr/openFileAttr";
import {exportLayout} from "../layout/export/exportLayout";
import { saveScroll } from "../protyle/scroll/saveScroll";
import { hasClosestByClassName } from "../protyle/util/hasClosest";
import { getModelByDockType } from "./api/getModelByDockType";
import { expandDocTree } from "./api/expandDocTree";
import { openTab } from "./api/openTab";
import { openWindow } from "./api/openWindow";
import { openEmojiPanel } from "../emoji";


// S-forge: openTab, openWindow, getModelByDockType, expandDocTree 已模块化到 ./api/ 目录

/**
 * 打开块属性面板
 *
 * 作用：根据传入的 data 或 nodeElement 打开对应的属性面板
 * 意图：为插件提供统一的属性面板入口
 * 调用时机：插件通过 API.openAttributePanel 调用
 */
const openAttributePanel = (options: {
    data?: Record<string, string>  // 块属性值
    nodeElement?: HTMLElement,  // 块元素
    focusName: "bookmark" | "name" | "alias" | "memo" | "av" | "custom",    // av 为数据库页签，custom 为自定义页签，其余为内置输入框
    protyle?: IProtyle, // 有数据库时需要传入 protyle
}) => {
    // 优先使用 data 打开文件属性面板（无需 DOM 元素）
    if (options.data) {
        openFileAttr(options.data, options.focusName, options.protyle);
        return;
    }
    // nodeElement 或 protyle 不存在时无法打开属性面板
    if (!options.nodeElement || !options.protyle) {
        return;
    }
    openAttr(options.nodeElement, options.focusName, options.protyle);
};

/**
 * 保存当前布局状态
 *
 * 作用：移动端保存编辑器滚动位置，桌面端导出完整布局
 * 意图：为插件提供统一的布局保存入口
 * 调用时机：插件通过 API.saveLayout 调用
 */
const saveLayout = (cb: () => void) => {
    // 非移动端：导出完整布局
    if (!isMobile()) {
        exportLayout({ cb, errorExit: false });
        return;
    }
    const mobileEditor = getMobileEditor();
    // 编辑器不存在时无需保存滚动位置
    if (!mobileEditor) {
        return;
    }
    const result = saveScroll(mobileEditor.protyle);
    // saveScroll 可能返回 Promise（异步保存场景），需等待完成后再回调
    if (cb && result instanceof Promise) {
        result.then(() => {
            cb();
        });
    }
};

/**
 * 获取当前活跃的编辑器实例
 *
 * 作用：在移动端返回弹出/主编辑器，桌面端按优先级查找活跃编辑器
 * 意图：为插件提供统一的活跃编辑器获取入口
 * 调用时机：插件通过 API.getActiveEditor 调用
 * @param wndActive - 为 false 时，即使没有活跃窗口也会按最近激活时间查找
 */
const getActiveEditor = (wndActive = true) => {
    // 非移动端：委托桌面端查找逻辑
    if (!isMobile()) {
        return getActiveDesktopEditor(wndActive);
    }
    const editor = getMobilePopEditor() || getMobileEditor();
    // 编辑器被隐藏时视为不存在
    if (editor?.protyle.element.classList.contains("fn__none")) {
        return undefined;
    }
    return editor;
};

/**
 * 桌面端活跃编辑器查找
 *
 * 作用：按优先级查找桌面端活跃编辑器（选区 > 活跃窗口 > 最近激活时间）
 * 意图：从 getActiveEditor 中提取桌面端逻辑，消除嵌套 if
 * 调用时机：getActiveEditor 在非移动端时调用
 */
const getActiveDesktopEditor = (wndActive: boolean) => {
    const sel = getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
    const allEditor = getAllEditor();
    // 优先查找包含当前选区的可见编辑器（选区所在编辑器必须未被隐藏）
    let editor = range
        ? allEditor.find(item =>
            !item.protyle.element.classList.contains("fn__none") &&
            item.protyle.element.contains(range.startContainer))
        : undefined;
    // 其次查找位于活跃窗口中的可见编辑器
    if (!editor) {
        editor = allEditor.find(item =>
            !item.protyle.element.classList.contains("fn__none") &&
            hasClosestByClassName(item.protyle.element, "layout__wnd--active", true));
    }
    // 允许非活跃窗口时，按 tab 最近激活时间查找
    if (!editor && !wndActive) {
        editor = findEditorByActiveTime(allEditor);
    }
    return editor;
};

/**
 * 按 tab 激活时间查找最近使用的编辑器
 *
 * 作用：遍历所有编辑器，找到 tab 头部标记为 item--focus 且激活时间最大的编辑器
 * 意图：当没有明确活跃窗口时，回退到最近使用的编辑器
 * 调用时机：getActiveDesktopEditor 在 wndActive=false 且未找到编辑器时调用
 */
const findEditorByActiveTime = (allEditor: ReturnType<typeof getAllEditor>) => {
    let activeTime = 0;
    let editor: ReturnType<typeof getAllEditor>[number] | undefined;
    for (const item of allEditor) {
        const headerElement = resolveTabHeader(item);
        // 无 tab 头部元素时，仅在编辑器可见时作为兜底候选
        if (!headerElement) {
            editor = item.protyle.element.getBoundingClientRect().height > 0 ? item : editor;
            continue;
        }
        const activetime = headerElement.dataset.activetime ?? "0";
        // 选择 item--focus 且激活时间最大的 tab 对应的编辑器
        if (headerElement.classList.contains("item--focus") && parseInt(activetime) > activeTime) {
            activeTime = parseInt(activetime);
            editor = item;
        }
    }
    return editor;
};

/**
 * 解析编辑器对应的 tab 头部元素
 *
 * 作用：先从 model 获取 headElement，若不存在则通过 DOM 查询匹配
 * 意图：编辑器可能没有直接关联的 model（如浮动面板），需要通过 DOM 回退查找
 * 调用时机：findEditorByActiveTime 中为每个编辑器调用
 */
const resolveTabHeader = (item: ReturnType<typeof getAllEditor>[number]): HTMLElement | undefined => {
    const fromModel = item.protyle.model?.parent.headElement;
    // model 上有 headElement 时直接返回
    if (fromModel) {
        return fromModel;
    }
    // 编辑器不可见时无需查找 tab 头部
    if (item.protyle.element.getBoundingClientRect().height <= 0) {
        return undefined;
    }
    const tabBodyElement = item.protyle.element.closest(".fn__flex-1[data-id]");
    if (!tabBodyElement) {
        return undefined;
    }
    const queried = document.querySelector(`.layout-tab-bar .item[data-id="${tabBodyElement.getAttribute("data-id")}"]`);
    // 使用类型守卫替代 as 断言
    if (isHTMLElement(queried)) {
        return queried;
    }
    return undefined;
};


/**
 * openMobileFileById 的注册表代理
 *
 * 作用：从 SForge 注册表获取 openMobileFileById 并转发调用
 * 意图：打断 mobile/editor ↔ plugin/API 循环依赖
 * 调用时机：插件通过 API.openMobileFileById 调用时
 */
const openMobileFileByIdProxy = (_app: AppFacade, id: string, action?: TProtyleAction[], scrollPosition?: ScrollLogicalPosition) => {
    const port = getSForgeState(SForgeSymbols.OPEN_MOBILE_FILE_BY_ID);
    // 仅在移动端注册了处理器时才执行，桌面端不注册此处理器
    if (isMobileFileOpenPort(port)) {
        port.open(id, action, scrollPosition);
    }
};

/** 通过完整应用外观调用官方插件 API 的设置入口，避免 API 聚合器反向加载配置组合根。 */
const openSettingViaApp = (app: AppFacade, tab?: SettingTabId) => app.openSettings(tab);

/** 通过完整应用外观调用全局命令路由，避免 API 聚合器反向加载命令组合根。 */
const globalCommandViaApp = (command: string, app: AppFacade) => app.globalCommand(command);

const openEmoji = (options: {
    position: IPosition,
    selectedCB?: (emoji: string) => void,
    dynamicIconURL?: string
    hideDynamicIcon?: boolean
    hideCustomIcon?: boolean
    targetID?: string
}) => {
    let dynamicImgElement: HTMLImageElement | undefined;
    if (options.dynamicIconURL) {
        dynamicImgElement = document.createElement("img");
        dynamicImgElement.src = options.dynamicIconURL;
    }
    openEmojiPanel("", "av", options.position, options.selectedCB, dynamicImgElement, {dynamic: options.hideDynamicIcon, custom: options.hideCustomIcon, targetID: options.targetID});
};

/**
 * 插件 API 聚合对象
 *
 * 作用：向插件暴露思源笔记内部 API
 * 意图：API.ts 作为聚合模块导入了大量内部模块，这些模块之间存在复杂的循环依赖链。
 *       所有外部导入通过 Object.defineProperty 定义为 lazy getter，
 *       确保在运行时（所有模块初始化完毕后）才访问绑定，
 *       从根本上避免模块初始化阶段的 TDZ (Temporal Dead Zone) 错误。
 * 调用时机：插件通过 this.api.xxx 访问
 */
export const API: Record<string, unknown> = {
    openMobileFileById: openMobileFileByIdProxy,
    openEmoji,
    getActiveEditor,
    openAttributePanel,
    saveLayout,
};

/**
 * 注册延迟绑定到 API 对象
 *
 * 作用：将导入的模块绑定注册为 API 对象的 lazy getter 属性
 * 意图：避免模块初始化阶段访问尚未初始化的循环依赖绑定（TDZ 错误）
 * 调用时机：模块加载时执行一次，所有 getter 在运行时首次访问时才求值
 */
function registerLazyBindings(target: Record<string, unknown>, bindings: Array<[string, () => unknown]>) {
    for (const [key, getter] of bindings) {
        Object.defineProperty(target, key, { get: getter, enumerable: true, configurable: true });
    }
}

registerLazyBindings(API, [
    ["adaptHotkey", () => updateHotkeyTip],
    ["confirm", () => confirmDialog],
    ["Constants", () => Constants],
    ["showMessage", () => showMessage],
    ["hideMessage", () => hideMessage],
    ["fetchPost", () => fetchPost],
    ["fetchSyncPost", () => fetchSyncPost],
    ["fetchGet", () => fetchGet],
    ["getFrontend", () => getFrontend],
    ["getBackend", () => getBackend],
    ["getModelByDockType", () => getModelByDockType],
    ["openTab", () => openTab],
    ["openWindow", () => openWindow],
    ["lockScreen", () => lockScreen],
    ["exitSiYuan", () => exitSiYuan],
    ["Protyle", () => Protyle],
    ["ProtyleMethod", () => ProtyleMethod],
    ["Plugin", () => Plugin],
    ["Dialog", () => Dialog],
    ["Menu", () => Menu],
    ["Setting", () => Setting],
    ["getAllEditor", () => getAllEditor],
    ["saveExportFile", () => saveExportFile],
    ["getActiveTab", () => getActiveTab],
    ["getAllModels", () => getAllModels],
    ["getAllTabs", () => getAllTabs],
    ["platformUtils", () => platformUtils],
    ["openSetting", () => openSettingViaApp],
    ["globalCommand", () => globalCommandViaApp],
    ["expandDocTree", () => expandDocTree],
]);
