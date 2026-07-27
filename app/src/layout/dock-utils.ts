/**
 * Dock 工具模块
 * 提供 Dock 序列化和反序列化的功能
 */
import { Dock } from "./dock";
import type { AppFacade } from "../app/AppFacade.types";
import { Constants } from "../constants";
import {
    getSiyuanLanguages,
    getSiyuanConfig,
    getSiyuanLayout,
} from "./dock/dock.environment";
import { isLayout } from "./layout.guard";
import { LayoutData } from "./dock-utils.types";
import { adjustDockPadding } from "./dock/util";

const DOCK_KEYS = ["left", "right", "bottom"] as const;

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

    for (let index = 0; index < dockItem.length; index++) {
        const existSubItem = dockItem[index];
        if (window.siyuan.isPublish && (existSubItem.type === "inbox" || existSubItem.type === "agentChat")) {
            dockItem.splice(index, 1);
            index--;
            continue;
        }
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

const ensureAgentChatDock = (layout: Pick<Config.IUiLayout, "left" | "right" | "bottom">): void => {
    let hasAgentChat = false;
    for (const key of DOCK_KEYS) {
        const sections = layout[key]?.data;
        if (!sections) {
            continue;
        }
        for (const sub of sections) {
            if (!sub) {
                continue;
            }
            for (let index = 0; index < sub.length; index++) {
                if (sub[index]?.type !== "agentChat") {
                    continue;
                }
                if (hasAgentChat) {
                    sub.splice(index, 1);
                    index--;
                    continue;
                }
                hasAgentChat = true;
            }
        }
    }
    if (hasAgentChat) {
        return;
    }
    for (const key of DOCK_KEYS) {
        const sections = Constants.SIYUAN_EMPTY_LAYOUT[key]?.data;
        if (!sections) {
            continue;
        }
        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const sub = sections[sectionIndex];
            if (!sub) {
                continue;
            }
            for (let itemIndex = 0; itemIndex < sub.length; itemIndex++) {
                const item = sub[itemIndex];
                const targetSections = layout[key]?.data;
                if (item?.type === "agentChat" && targetSections?.[sectionIndex]) {
                    targetSections[sectionIndex].splice(itemIndex, 0, { ...item });
                    return;
                }
            }
        }
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
export const JSONToDock = (json: LayoutData, app: AppFacade) => {
    ensureAgentChatDock(json);

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
