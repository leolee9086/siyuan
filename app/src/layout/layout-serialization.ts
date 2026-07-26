/**
 * 布局序列化模块
 * 提供布局的序列化、保存和导出功能
 * @同步豁免: 遗留代码 - 此模块从 util.ts 迁移，保持原有同步行为以确保兼容性
 */
import { Layout } from "./index";
import { Wnd } from "./Wnd";
import { Tab } from "./Tab";
import type {ILayoutModel} from "./lifecycle/model.types";
import { fetchPost } from "../util/network/fetch";
import { isWindow } from "../util/platform/functions";
import { Constants } from "../constants";
import { saveScroll } from "../protyle/scroll/saveScroll";
import { dockToJSON } from "./dock-utils";
import { getAllEditor } from "./getAll";
import { SerializationJSON, BreakObject } from "./layout-serialization.types";
import { serializeInstance } from "./layout-serialization.serializers";
import { getSiyuanLayout, getSiyuanConfig, setWindowTimeout } from "./dock/dock.environment";

/** 保存重试计数器，用于处理编辑器未初始化的情况 */
let saveCount = 0;

/**
 * 序列化 Layout 或 Wnd 的子元素
 * @同步豁免: UI构建 - 需要同步遍历子元素
 */
const serializeLayoutOrWndChildren = (
    layout: Layout | Wnd,
    json: SerializationJSON,
    breakObj?: BreakObject
): void => {
    // 检查是否为边缘布局（bottom/left/right），边缘布局使用默认值
    const isEdgeLayout = layout instanceof Layout &&
        (layout.type === "bottom" || layout.type === "left" || layout.type === "right");
    
    if (isEdgeLayout) {
        // 边缘布局清空内容，重置时使用 dock 数据
        const isBottom = layout.type === "bottom";
        const resizeDirection = isBottom ? "lr" : "tb";
        json.children = [
            { "instance": "Wnd", "children": [] },
            { "instance": "Wnd", "resize": resizeDirection, "children": [] }
        ];
        return;
    }
    
    // 普通布局递归序列化子元素
    const childrenArray: SerializationJSON[] = [];
    json.children = childrenArray;
    for (const item of layout.children) {
        const itemJSON: SerializationJSON = {};
        childrenArray.push(itemJSON);
        layoutToJSON(item, itemJSON, breakObj);
    }
};

/**
 * 序列化 Tab 的子元素
 * @同步豁免: UI构建 - 需要同步访问 Tab 的 model 和 headElement
 */
const serializeTabChildren = (layout: Tab, json: SerializationJSON, breakObj?: BreakObject): void => {
    // 如果 Tab 有 model，递归序列化
    if (layout.model) {
        const childJSON: SerializationJSON = {};
        json.children = childJSON;
        layoutToJSON(layout.model, childJSON, breakObj);
        return;
    }
    // 如果有头部元素但没有 model，说明页签未激活，从 data-initdata 获取
    if (layout.headElement) {
        json.children = JSON.parse(layout.headElement.getAttribute("data-initdata") || "{}");
        return;
    }
    // 没有头部元素，说明所有页签已关闭
    json.children = {};
};

/** 将布局实例递归转换为 JSON 格式 @同步豁免: UI构建 - 需要同步遍历整个布局树并访问DOM属性 */
export const layoutToJSON = (
    layout: Layout | Wnd | Tab | ILayoutModel,
    json: SerializationJSON,
    breakObj?: BreakObject
): void => {
    // 序列化实例自身的属性
    serializeInstance(layout, json, breakObj);
    
    // Layout 或 Wnd 实例需要序列化子元素
    if (layout instanceof Layout || layout instanceof Wnd) {
        serializeLayoutOrWndChildren(layout, json, breakObj);
        return;
    }
    // Tab 实例需要序列化其 model 或初始化数据
    if (layout instanceof Tab) {
        serializeTabChildren(layout, json, breakObj);
    }
};

/** 构建主窗口布局 JSON（包含 dock 信息） */
const buildMainWindowLayoutJSON = (): SerializationJSON | null => {
    const useElement = document.querySelector("#barDock use");
    // 如果找不到 dock 元素，返回 null
    if (!useElement) {
        return null;
    }
    const siyuanLayout = getSiyuanLayout();
    // 如果布局对象不存在，返回 null
    if (!siyuanLayout?.bottomDock || !siyuanLayout?.leftDock || !siyuanLayout?.rightDock) {
        return null;
    }
    return {
        hideDock: useElement.getAttribute("xlink:href") === "#iconDock",
        layout: {},
        bottom: dockToJSON(siyuanLayout.bottomDock),
        left: dockToJSON(siyuanLayout.leftDock),
        right: dockToJSON(siyuanLayout.rightDock),
    };
};

/** 序列化独立窗口模式的布局 */
const serializeWindowModeLayout = (breakObj?: BreakObject): SerializationJSON => {
    const layoutJSON: SerializationJSON = { layout: {} };
    const siyuanLayout = getSiyuanLayout();
    // 检查布局对象是否存在，存在则序列化
    if (siyuanLayout?.layout) {
        const layoutData: SerializationJSON = {};
        layoutJSON.layout = layoutData;
        layoutToJSON(siyuanLayout.layout, layoutData, breakObj);
    }
    return layoutJSON;
};

/** 处理主窗口模式的布局保存 */
const saveMainWindowModeLayout = (breakObj: BreakObject): SerializationJSON | null => {
    const layoutJSON = buildMainWindowLayoutJSON();
    const siyuanLayout = getSiyuanLayout();
    const siyuanConfig = getSiyuanConfig();
    // 如果构建失败或布局不存在，返回 null
    if (!layoutJSON || !siyuanLayout?.layout) {
        return null;
    }
    const layoutData: SerializationJSON = {};
    layoutJSON.layout = layoutData;
    layoutToJSON(siyuanLayout.layout, layoutData, breakObj);
    // 更新全局配置的 uiLayout 属性
    // 遗留代码：直接赋值给 uiLayout，类型兼容性由运行时保证
    updateConfigUiLayout(siyuanConfig, layoutJSON);
    return layoutJSON;
};

/** 更新配置中的 uiLayout（遗留代码兼容） */
const updateConfigUiLayout = (
    config: ReturnType<typeof getSiyuanConfig>,
    layoutJSON: SerializationJSON
): void => {
    // 检查配置对象是否存在且有 uiLayout 属性
    if (!config) {
        return;
    }
    // 遗留代码：uiLayout 的实际结构与 SerializationJSON 兼容
    // 使用 Object.assign 避免类型断言
    Object.assign(config.uiLayout, layoutJSON);
};

/** 执行实际的布局保存操作 */
const performSave = (layoutJSON: SerializationJSON, isWindowMode: boolean): void => {
    // 独立窗口模式保存到 sessionStorage
    if (isWindowMode) {
        sessionStorage.setItem("layout", JSON.stringify(layoutJSON));
        return;
    }
    const siyuanConfig = getSiyuanConfig();
    // 只读模式不保存
    if (siyuanConfig?.readonly) {
        return;
    }
    fetchPost("/api/system/setUILayout", { layout: layoutJSON, errorExit: false });
};

/** 保存当前布局到后端 @同步豁免: 遗留代码 - 保持原有同步行为，内部使用 setTimeout 进行重试 */
export const saveLayout = (): void => {
    const breakObj: BreakObject = {};
    const isWindowMode = isWindow();
    
    // 根据窗口模式选择不同的保存逻辑
    const layoutJSON = isWindowMode
        ? serializeWindowModeLayout(breakObj)
        : saveMainWindowModeLayout(breakObj);
    
    // 主窗口模式下如果构建失败，直接返回
    if (!layoutJSON) {
        return;
    }
    
    // 检查是否有编辑器未初始化，需要延迟重试
    const hasUninitializedEditor = Object.keys(breakObj).length > 0;
    const canRetry = saveCount < 10;
    // 当存在未初始化的编辑器且重试次数未超限时，延迟重试保存
    // 这是因为编辑器可能还在加载中，需要等待其初始化完成
    if (hasUninitializedEditor && canRetry) {
        saveCount++;
        // 遗留代码：使用 setTimeout 等待编辑器初始化完成后重试
        setWindowTimeout(() => {
            saveLayout();
        }, Constants.TIMEOUT_LOAD * saveCount);
        return;
    }
    
    // 重置重试计数并执行保存
    saveCount = 0;
    performSave(layoutJSON, isWindowMode);
};

/** 导出布局配置（带回调），保存所有编辑器的滚动位置后将布局导出 */
export const exportLayout = async (options: { cb: () => void; errorExit: boolean }) => {
    // 保存所有编辑器的滚动位置
    const editors = getAllEditor();
    for (const editor of editors) {
        await saveScroll(editor.protyle);
    }
    
    // 独立窗口模式
    if (isWindow()) {
        const layoutJSON = serializeWindowModeLayout();
        sessionStorage.setItem("layout", JSON.stringify(layoutJSON));
        options.cb();
        return;
    }
    
    // 主窗口模式
    const layoutJSON = buildMainWindowLayoutJSON();
    // 如果构建失败，直接返回
    if (!layoutJSON) {
        options.cb();
        return;
    }
    const siyuanLayout = getSiyuanLayout();
    // 检查布局对象是否存在
    if (siyuanLayout?.layout) {
        const layoutData: SerializationJSON = {};
        layoutJSON.layout = layoutData;
        layoutToJSON(siyuanLayout.layout, layoutData);
    }
    
    const siyuanConfig = getSiyuanConfig();
    // 只读模式直接回调
    if (siyuanConfig?.readonly) {
        options.cb();
        return;
    }
    
    // 保存到后端并回调
    fetchPost("/api/system/setUILayout", {
        layout: layoutJSON,
        errorExit: options.errorExit
    }, () => {
        options.cb();
    });
};

/** 获取完整布局数据 @同步豁免: UI构建 - 需要同步获取当前布局状态 */
export const getAllLayout = (): SerializationJSON => {
    const siyuanLayout = getSiyuanLayout();
    // 获取 dock 元素并检查其状态
    const dockUseElement = document.querySelector("#barDock use");
    const hideDock = dockUseElement?.getAttribute("xlink:href") === "#iconDock";
    const layoutJSON: SerializationJSON = {
        hideDock,
        layout: {},
        bottom: siyuanLayout?.bottomDock ? dockToJSON(siyuanLayout.bottomDock) : undefined,
        left: siyuanLayout?.leftDock ? dockToJSON(siyuanLayout.leftDock) : undefined,
        right: siyuanLayout?.rightDock ? dockToJSON(siyuanLayout.rightDock) : undefined,
    };
    // 检查布局对象是否存在
    if (siyuanLayout?.layout) {
        const layoutData: SerializationJSON = {};
        layoutJSON.layout = layoutData;
        layoutToJSON(siyuanLayout.layout, layoutData);
    }
    return layoutJSON;
};
