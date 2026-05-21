/**
 * Dock 工具模块
 * 提供 Dock 序列化和反序列化的功能
 */
import { Dock } from "./dock";
import { App } from "../index";
import {
    getSiyuanLanguages,
    getSiyuanConfig,
    getSiyuanLayout,
} from "./dock/dock.environment";
import { isLayout } from "./layout.guard";
import { LayoutData } from "./dock-utils.types";
import { adjustDockPadding } from "./dock/util";

/**
 * 将 Dock 元素序列化为 JSON 格式
 *
 * 作用：将当前 Dock 的 UI 状态（包括标签页类型、尺寸、标题、激活状态等）
 *       转换为可持久化的 JSON 数据，用于保存布局配置
 * 意图：实现 Dock 状态的保存和恢复功能
 * 调用时机：保存布局配置时（如关闭应用、手动保存布局等）
 *
 * @同步豁免: UI构建 - DOM访问需要同步执行，且是数据序列化操作，不涉及异步资源
 *
 * @param dock - 需要序列化的 Dock 实例
 * @returns 包含 pin 状态和标签页数据的 JSON 对象
 */
export const dockToJSON = (dock: Dock): { pin: boolean; data: Config.IUILayoutDockTab[][] } => {
    const data0 = extractSubDockItems(dock, 0);
    const data2 = extractSubDockItems(dock, 1);
    const json: Config.IUILayoutDockTab[][] = [];

    // 添加上部数据（如果有数据的话）
    const hasUpperData = data0.length > 0 || data2.length > 0;
    if (hasUpperData) {
        // https://github.com/siyuan-note/siyuan/issues/5641
        // 即使上部为空，如果有下部数据也需要添加上部，保持索引一致性
        json.push(data0);
    }

    // 添加下部数据（如果存在）
    if (data2.length > 0) {
        json.push(data2);
    }

    return {
        pin: dock.pin,
        data: json
    };
};

/**
 * 从 Dock 元素中提取特定区域的标签页数据
 *
 * 作用：处理单个 Dock 区域（上/下）中的所有标签页，提取属性和状态
 * 调用时机：dockToJSON 内部使用
 *
 * @同步豁免: 需要绝对同步的DOM访问 - 使用 querySelectorAll 获取元素并同步读取属性
 *
 * @param dock - Dock 实例
 * @param index - 区域索引，0 表示上半部分，1 表示下半部分
 * @returns Dock 项配置数组
 */
const extractSubDockItems = (dock: Dock, index: number): Config.IUILayoutDockTab[] => {
    const data: Config.IUILayoutDockTab[] = [];
    const items = dock.elements[index].querySelectorAll(".dock__item");

    // 遍历所有 Dock 项，提取其属性和状态
    for (const item of items) {
        if (!item.getAttribute("data-type")) {
            continue;
        }
        const useElement = item.querySelector("use");
        const iconHref = useElement?.getAttribute("xlink:href") || "";
        const heightAttr = item.getAttribute("data-height");
        const widthAttr = item.getAttribute("data-width");

        data.push({
            type: item.getAttribute("data-type") || "",
            size: {
                height: heightAttr ? parseInt(heightAttr, 10) : 0,
                width: widthAttr ? parseInt(widthAttr, 10) : 0,
            },
            title: item.getAttribute("data-title") || "",
            show: item.classList.contains("dock__item--active"),
            icon: iconHref.substring(1), // 移除 # 前缀
            hotkey: item.getAttribute("data-hotkey") || "",
            hotkeyLangId: item.getAttribute("data-hotkeylangid") || ""
        });
    }

    return data;
};

/**
 * 初始化内部 Dock 项的本地化配置
 *
 * 作用：根据 hotkeyLangId 更新 Dock 项的标题和热键
 *       从应用的国际化配置中加载对应的语言和快捷键设置
 * 意图：实现 Dock 项标题和热键的本地化初始化
 * 调用时机：从配置恢复 Dock 布局时，用于同步语言包中的最新翻译和快捷键
 *
 * @同步豁免: UI构建 - 初始化过程中的配置同步操作，不涉及异步资源
 *
 * @param dockItem - 需要初始化的 Dock 项配置数组
 */
export const initInternalDock = (dockItem: Config.IUILayoutDockTab[]): void => {
    const languages = getSiyuanLanguages();
    const config = getSiyuanConfig();

    // 没有语言和配置信息时无法本地化处理，直接返回
    if (!languages || !config) {
        return;
    }

    for (const existSubItem of dockItem) {
        // 没有语言 ID 的项无法本地化处理，跳过
        if (!existSubItem.hotkeyLangId) {
            continue;
        }

        // 从语言包中获取标题
        const languageTitle = languages[existSubItem.hotkeyLangId];
        if (languageTitle) {
            existSubItem.title = languageTitle;
        }

        // 从快捷键配置中获取自定义快捷键
        // 注意：custom_list 等自定义类型可能没有对应的快捷键配置，需要检查存在性
        const keymapEntry = config.keymap?.general?.[existSubItem.hotkeyLangId];
        if (!keymapEntry) {
            continue;
        }

        existSubItem.hotkey = keymapEntry.custom;
    }
};

/**
 * 从 JSON 配置初始化所有 Dock 实例
 *
 * 作用：根据保存的 JSON 配置数据，初始化左侧、右侧和底部三个 Dock 实例
 *       设置中央布局区域，并将 Dock 实例挂载到全局布局对象
 * 意图：实现应用启动时从配置恢复完整的 Dock 布局
 * 调用时机：应用启动、布局重置后恢复布局时
 *
 * @同步豁免: UI构建 - 布局初始化是同步构建过程，需要按顺序创建 DOM 元素和设置引用
 *
 * @param json - 包含左、右、底三个 Dock 配置的布局数据
 * @param app - 应用主实例，用于创建 Dock
 */
export const JSONToDock = (json: LayoutData, app: App): void => {
    // 初始化左侧 Dock 配置（本地化标题和热键）
    for (const existItem of json.left.data) {
        initInternalDock(existItem);
    }

    // 初始化右侧 Dock 配置
    for (const existItem of json.right.data) {
        initInternalDock(existItem);
    }

    // 初始化底部 Dock 配置
    for (const existItem of json.bottom.data) {
        initInternalDock(existItem);
    }

    // 获取思源布局对象
    const layout = getSiyuanLayout();
    if (!layout) {
        return;
    }

    // 获取布局根元素的子元素
    const layoutRoot = layout.layout;
    if (!layoutRoot) {
        return;
    }

    const firstChild = layoutRoot.children[0];
    if (!firstChild) {
        return;

    }

    // 获取中央布局区域引用（布局树的第二个子元素）
    // 布局树结构：[[顶部区域], [中央布局], [底部区域]]
    const centerLayoutCandidate = firstChild.children[1];

    // 验证候选对象是否是有效的 Layout 实例
    // 在布局初始化时，centerLayout 应该已经从布局 JSON 中创建，这里确保引用正确
    if (isLayout(centerLayoutCandidate)) {
        layout.centerLayout = centerLayoutCandidate;
    }

    // 创建左侧 Dock 实例
    layout.leftDock = new Dock({
        position: "Left",
        data: json.left,
        app
    });

    // 创建右侧 Dock 实例
    layout.rightDock = new Dock({
        position: "Right",
        data: json.right,
        app
    });

    // 创建底部 Dock 实例
    layout.bottomDock = new Dock({
        position: "Bottom",
        data: json.bottom,
        app
    });
    adjustDockPadding();
};
