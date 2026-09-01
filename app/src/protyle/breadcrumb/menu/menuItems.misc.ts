/*
 * 用途：创建面包屑更多菜单中的具体菜单项实例。
 * 使用范围：本文件所有菜单项构建函数都依赖它生成可追加到菜单容器的 DOM 元素。
 * 解耦评估：作为菜单系统的核心类型，理论上可通过接口抽象进一步解耦；但当前文件本身就是菜单构建层，直接依赖由 [`imports.ts`](app/src/protyle/breadcrumb/menu/imports.ts) 转发的实现更清晰。
 */
import { MenuItem } from "./imports";
/*
 * 用途：提供面包屑更多菜单的容器类型与追加能力。
 * 使用范围：本文件全部导出函数都通过它向现有菜单容器追加条目。
 * 解耦评估：可以通过更窄的 append 接口参数传入以降低耦合；但当前菜单辅助函数已统一以 [`Menu`](app/src/protyle/breadcrumb/menu/imports.ts) 为边界，继续直接使用更符合现有模块约定。
 */
import { Menu } from "./imports";
/*
 * 用途：提供菜单标签所需的国际化文案。
 * 使用范围：本文件所有展示给用户的菜单文本都从该环境服务读取。
 * 解耦评估：可通过调用方传入文案映射进一步解耦；但这会让每个菜单构建点重复传递相同依赖，当前由 [`imports.ts`](app/src/protyle/breadcrumb/menu/imports.ts) 统一转发更合适。
 */
import { siyuanI18n } from "./imports";
/*
 * 用途：判断当前编辑器是否还有未加载的动态文档边界。
 * 使用范围：仅在可滚动文档的更多菜单中决定是否显示“加载全部内容”。
 */
import { hasUnloadedDocumentBlocks } from "./imports";
/*
 * 用途：判断当前是否为移动端环境。
 * 使用范围：刷新和全屏菜单项中用于决定刷新行为与是否展示全屏入口。
 * 解耦评估：可通过平台能力对象注入解耦；但这些判断属于视图层展示条件，直接使用环境检测转发即可。
 */
import { isMobile } from "./imports";
/*
 * 用途：刷新当前 Protyle 视图。
 * 使用范围：刷新菜单项点击后触发当前编辑器重新加载。
 * 解耦评估：可通过命令总线或动作分发解耦；但当前仅在单一菜单点击回调内调用，直接依赖更直观。
 */
import { reloadProtyle } from "./imports";
/*
 * 用途：在执行排版优化前隐藏指定界面元素。
 * 使用范围：优化排版菜单项点击后隐藏工具栏，避免操作过程中的视觉干扰。
 * 解耦评估：可通过事件通知 UI 层自行处理；但该行为与菜单动作强绑定，直接调用的复杂度最低。
 */
import { hideElements } from "./imports";
/*
 * 用途：向后端发送格式化请求。
 * 使用范围：优化排版菜单项点击后调用自动空格接口。
 * 解耦评估：可通过服务层包装再注入，但当前文件只是薄 UI 层，直接使用基础请求能力即可。
 */
import { fetchPost } from "./imports";
/*
 * 用途：切换当前编辑器的全屏状态。
 * 使用范围：全屏菜单项点击后执行界面状态切换。
 * 解耦评估：可通过命令封装进一步解耦；但它与面包屑交互属于同一功能域，直接转发依赖可接受。
 */
/*
 * 用途：在全屏切换后重新计算编辑器布局尺寸。
 * 使用范围：全屏菜单项点击后，紧随全屏切换执行尺寸同步。
 * 解耦评估：可改为监听全屏状态事件自动调整；但当前调用顺序需要与点击动作紧邻，直接导入更稳妥。
 */
import { resize } from "./imports";
/*
 * 用途：读取快捷键等全局配置。
 * 使用范围：刷新、优化排版、全屏等菜单项展示 accelerator 时使用。
 * 解耦评估：可由上层预先传入配置快照；但该菜单模块整体都依赖全局配置，当前直接访问保持调用方简洁。
 */
import { getSiyuanConfig } from "./imports";
/*
 * 用途：判断当前是否处于 Android 运行环境。
 * 使用范围：上传与录音分组中决定是否展示录音菜单项。
 * 解耦评估：更理想的方案是使用统一能力探测接口；在现有录音能力仍按平台分支时，直接引入环境判断仍是最小改动方案。
 */
import { isInAndroid } from "./imports";
/*
 * 用途：判断当前是否处于 Harmony 运行环境。
 * 使用范围：上传与录音分组中决定是否展示录音菜单项。
 * 解耦评估：更理想的方案是使用统一能力探测接口；在现有录音能力仍按平台分支时，直接引入环境判断仍是最小改动方案。
 */
import { isInHarmony } from "./imports";
/*
 * 用途：为录音相关状态提供类型约束。
 * 使用范围：上传与录音分组函数参数中仅用于静态类型标注，不参与运行时逻辑。
 * 解耦评估：类型依赖本身耦合成本很低；若未来录音上下文边界进一步稳定，也可在 [`imports.ts`](app/src/protyle/breadcrumb/menu/imports.ts) 中继续统一转发类型。
 */
import type { 录音器上下文 } from "./imports";
/*
 * 用途：构建上传入口菜单项。
 * 使用范围：上传与录音分组函数在所有可交互面包屑菜单中都会优先追加该入口。
 * 解耦评估：可将子菜单构建函数作为参数传入解耦；但当前同目录菜单模块拆分后通过显式依赖协作，边界已足够清晰。
 */
import { 添加上传菜单项 } from "./menuItems.upload";
/*
 * 用途：构建录音入口菜单项。
 * 使用范围：上传与录音分组函数在支持录音的平台上追加该入口。
 * 解耦评估：可由调用方根据能力判断后注入回调解耦；但现有平台判断就位于同一分组逻辑中，直接依赖更易维护。
 */
import { 添加录音菜单项 } from "./menuItems.upload";

/**
 * 作用：为面包屑更多菜单追加上传入口，并在支持的平台上追加录音入口。
 * 意图：将上传与录音这一组与附件输入相关的菜单构建逻辑集中到同一处，避免调用方重复处理可见性与平台兼容判断。
 * 调用时机：在 [`构建菜单内容()`](app/src/protyle/breadcrumb/menu/showBreadcrumbMenu.ts:174) 中创建面包屑菜单内容时调用，此时菜单需要同步完成 UI 组装。
 * 问题/改进：当前平台判断仍基于环境分支硬编码在菜单层；如果未来录音能力改为能力探测或支持更多平台，可进一步下沉为统一的特性检测接口。
 * @同步豁免: UI构建 - 该函数只负责同步拼装当前菜单项，调用方需要在菜单显示前立即完成 DOM/UI 结构构建，不适合改为异步导出。
 */
export function 添加上传与录音组(
    protyle: IProtyle,
    menu: Menu,
    录音上下文: 录音器上下文
) {
    if (!protyle.contentElement || protyle.contentElement.classList.contains("fn__none") || protyle.disabled) {
        return;
    }
    添加上传菜单项(protyle, menu);
    // 录音菜单项目前只在 Android 与 Harmony 环境启用，其他平台在当前能力实现下无法提供对应录音入口，因此这里显式跳过，避免展示不可用操作。
    if (!isInAndroid() && !isInHarmony()) {
        return;
    }
    添加录音菜单项(protyle, menu, 录音上下文);
}

/**
 * 作用：为支持滚动容器的编辑器添加“加载全部内容”和“保持已加载内容”操作。
 * 意图：让用户可以补齐动态文档边界，或选择保留当前已加载的内容。
 * 调用时机：在 [`构建菜单内容()`](app/src/protyle/breadcrumb/menu/showBreadcrumbMenu.ts:174) 中组装基础编辑器菜单时调用。
 * @同步豁免: 菜单展示前必须同步判断当前滚动范围并追加条目。
 */
export function 添加懒加载菜单项(protyle: IProtyle, menu: Menu) {
    const scroll = protyle.scroll;
    if (!scroll || scroll.element.classList.contains("fn__none")) {
        return;
    }

    if (hasUnloadedDocumentBlocks(protyle.wysiwyg.element, true)) {
        menu.append(new MenuItem({
            id: "loadAllContent",
            icon: "iconSelectAll",
            label: siyuanI18n.loadAllContent,
            click: () => {
                void scroll.loadAll(protyle);
            },
        }).element);
    }

    menu.append(new MenuItem({
        id: "keepLazyLoad",
        icon: "iconKeepContent",
        current: scroll.keepLoadedContent,
        label: siyuanI18n.keepLazyLoad,
        click: () => {
            scroll.keepLoadedContent = !scroll.keepLoadedContent;
        },
    }).element);
}

/**
 * 作用：向面包屑更多菜单追加刷新入口，并在需要时补充分隔符。
 * 意图：将刷新能力放在菜单基础操作区，方便用户在编辑器状态异常或内容需要重载时快速恢复。
 * 调用时机：在 [`构建菜单内容()`](app/src/protyle/breadcrumb/menu/showBreadcrumbMenu.ts:174) 中基础编辑器操作区构建阶段调用。
 * 问题/改进：当前分隔符插入依赖现有菜单尾节点状态判断，后续若菜单分组改为数据驱动，可进一步抽象为统一分组渲染器。
 * @同步豁免: UI构建 - 菜单显示前必须同步确定是否插入分隔符并立即追加刷新项。
 */
export function 添加刷新菜单项(protyle: IProtyle, menu: Menu) {
    // 当前面包屑菜单尾部已经存在实际菜单内容时，先插入分隔符，避免刷新操作与上一个功能分组视觉上混在一起。
    if (menu.element.lastElementChild && menu.element.lastElementChild.childElementCount > 0) {
        menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }

    menu.append(new MenuItem({
        id: "refresh",
        icon: "iconRefresh",
        accelerator: getSiyuanConfig().keymap.editor.general.refresh.custom,
        label: siyuanI18n.refresh,
        /**
         * 作用：触发当前 Protyle 的刷新流程。
         * 意图：复用既有刷新能力，确保菜单入口与其他刷新触发点保持一致行为。
         * 调用时机：用户点击“刷新”菜单项时触发。
         * 问题/改进：若后续刷新成本上升，可考虑在这里增加执行中态或节流策略。
         */
        click: () => {
            reloadProtyle(protyle, !isMobile);
        }
    }).element);
}

/**
 * 作用：在可编辑文档的面包屑更多菜单中追加“优化排版”入口。
 * 意图：让用户直接从上下文菜单触发自动空格排版，而不必切换到其他工具栏入口。
 * 调用时机：在 [`构建菜单内容()`](app/src/protyle/breadcrumb/menu/showBreadcrumbMenu.ts:174) 中，仅当当前编辑器未禁用时调用。
 * 问题/改进：当前请求发出后没有在本函数内观察结果反馈；若后续需要更强可感知性，可补充完成提示或失败处理。
 * @同步豁免: UI构建 - 菜单项本身必须同步创建，异步部分已经留在点击回调内处理。
 */
export function 添加优化排版菜单项(protyle: IProtyle, menu: Menu) {
    if (!protyle.disabled) {
        menu.append(new MenuItem({
            id: "optimizeTypography",
            label: siyuanI18n.optimizeTypography,
            accelerator: getSiyuanConfig().keymap.editor.general.optimizeTypography.custom,
            icon: "iconFormat",
            /**
             * 作用：隐藏工具栏并向后端发送自动空格排版请求。
             * 意图：减少排版过程中界面干扰，并复用后端已有格式化能力统一处理文档内容。
             * 调用时机：用户点击“优化排版”菜单项时触发。
             * 问题/改进：当前未等待接口回调；如果未来需要在成功后恢复某些 UI 状态，可进一步补齐异步反馈链路。
             */
            click: () => {
                hideElements(["toolbar"], protyle);
                fetchPost("/api/format/autoSpace", {
                    id: protyle.block.rootID
                });
            }
        }).element);
    }
}

/**
 * 作用：在桌面端面包屑更多菜单中追加全屏切换入口。
 * 意图：让用户在当前编辑上下文内直接切换编辑器全屏状态，并保持图标与当前状态一致。
 * 调用时机：在 [`构建菜单内容()`](app/src/protyle/breadcrumb/menu/showBreadcrumbMenu.ts:174) 中基础编辑器操作区构建阶段调用。
 * 问题/改进：当前仅依据 CSS 类名判断图标状态，若未来全屏状态来源增多，可考虑抽成专用状态选择器。
 * @同步豁免: UI构建 - 全屏菜单项需要在桌面端菜单显示前立即生成，点击后的状态变化再由后续同步逻辑处理。
 */
export function 添加全屏菜单项(protyle: IProtyle, menu: Menu) {
    if (isMobile) {
        return;
    }
    menu.append(new MenuItem({
        id: "fullscreen",
        icon: protyle.element.className.includes("fullscreen") ? "iconFullscreenExit" : "iconFullscreen",
        accelerator: getSiyuanConfig().keymap.editor.general.fullscreen.custom,
        label: siyuanI18n.fullscreen,
        /**
         * 作用：切换当前编辑器全屏状态并重新计算布局。
         * 意图：确保用户从菜单进入全屏后，编辑器尺寸立即与新容器状态对齐。
         * 调用时机：用户点击“全屏”菜单项时触发。
         * 问题/改进：若未来全屏切换改为异步动画流程，可能需要在动画结束后再触发尺寸重算。
         */
        click: () => {
            protyle.app.toggleFullscreen(protyle.element);
            resize(protyle);
        }
    }).element);
}

/**
 * 作用：在面包屑更多菜单底部追加当前文档统计信息。
 * 意图：把字数、块数等只读统计与编辑操作放在同一菜单中，减少用户切换查看位置的成本。
 * 调用时机：在 [`构建菜单内容()`](app/src/protyle/breadcrumb/menu/showBreadcrumbMenu.ts:174) 末尾、插件菜单项之后调用。
 * 问题/改进：当前 HTML 文本仍由字符串拼接构建，后续若统计字段继续增加，可提取为模板生成函数提升可维护性。
 * @同步豁免: UI构建 - 统计信息属于菜单只读展示区，需要在菜单弹出前一次性同步构建完成。
 */
export function 添加文档信息菜单项(menu: Menu, response: IWebSocketData) {
    if (!response.data || !response.data.stat) {
        return;
    }
    menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    menu.append(new MenuItem({
        id: "docInfo",
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex">${siyuanI18n.runeCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.runeCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.wordCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.wordCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.linkCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.linkCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.imgCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.imageCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.refCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.refCount}</div>` +
            `<div class="fn__flex">${siyuanI18n.blockCount}<span class="fn__space fn__flex-1"></span>${response.data.stat.blockCount}</div>`,
    }).element);
}
