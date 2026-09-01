/**
 * 用途：把 LOCAL_DOCINFO 写回本地存储。
 * 使用范围：仅移动端退出聚焦流程。
 * 解耦评估：存储写入能力通过 imports.ts 集中转发，后续可替换为环境层实现。
 */
import { setStorageVal } from "./imports";
/**
 * 用途：发起后端接口请求。
 * 使用范围：主文档 `getDoc` 加载。
 * 解耦评估：统一走 fetchPost，业务层不关心底层请求细节。
 */
import { fetchPost } from "./imports";
/**
 * 用途：读取流程常量。
 * 使用范围：动作码与本地存储键。
 * 解耦评估：常量集中维护，避免在业务代码写魔法值。
 */
import { Constants } from "./imports";
/**
 * 用途：更新反向链接图。
 * 使用范围：桌面端退出聚焦流程的收尾阶段。
 * 解耦评估：反链更新逻辑独立于菜单流程，后续可改为事件触发。
 */
import { updateBacklinkGraph } from "./imports";
/**
 * 用途：读取当前全部模型。
 * 使用范围：同步大纲当前项。
 * 解耦评估：模型获取统一入口，避免菜单层直接耦合布局细节。
 */
import { getAllModels } from "./imports";
/**
 * 用途：判断当前是否移动端。
 * 使用范围：决定是否执行大纲与反链更新。
 * 解耦评估：平台能力在平台层维护，业务只消费判断结果。
 */
import { isMobile } from "./imports";
/**
 * 用途：写入移动端回退栈。
 * 使用范围：移动端退出聚焦流程。
 * 解耦评估：导航栈维护在移动模块，业务层通过接口调用。
 */
import {pushMobileBack} from "./imports";
/**
 * 用途：向上查找 block popover。
 * 使用范围：修正 pin 按钮状态。
 * 解耦评估：DOM 查找工具复用，避免重复实现节点遍历。
 */
import { hasClosestByClassName } from "./imports";
/**
 * 用途：把后端响应应用到 protyle。
 * 使用范围：主文档加载响应处理。
 * 解耦评估：渲染入口统一，有利于后续替换响应管线。
 */
import { onGet } from "./imports";
/**
 * 用途：聚焦目标块元素。
 * 使用范围：复用已渲染焦点时直接定位。
 * 解耦评估：聚焦细节由工具层封装，菜单层不操作底层选区。
 */
import { focusBlock } from "./imports";
/**
 * 用途：读取 pin 状态文案。
 * 使用范围：block popover pin 状态修正。
 * 解耦评估：i18n 来源统一，避免文案分散。
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：读取移动端上下文。
 * 使用范围：判断是否处于 mobile editor。
 * 解耦评估：通过环境层封装替代 window 直接访问。
 */
import { getSafeSiyuanMobile } from "./imports";
/**
 * 用途：读取运行时配置。
 * 使用范围：获取 `dynamicLoadBlocks`。
 * 解耦评估：配置读取经环境层封装，边界清晰。
 */
import { getSiyuanConfig } from "./imports";
/** 用途：统一构造加密感知的 getDoc 参数。使用范围：zoomOut 主文档加载。解耦评估：同目录请求 helper。 */
import { createZoomOutGetDocParams } from "./protyle.zoomOut.request";
/**
 * 用途：读取运行时存储对象。
 * 使用范围：写入 LOCAL_DOCINFO 前后同步。
 * 解耦评估：存储访问通过环境层封装，降低全局耦合。
 */
import { getSiyuanStorage } from "./imports";
/**
 * 用途：焦点恢复子流程。
 * 使用范围：主文档响应后的焦点恢复与补偿请求。
 * 解耦评估：按关注点拆分模块，主文件只保留编排逻辑。
 */
import { 处理ZoomOut焦点恢复 } from "./protyle.zoomOut.focus";
/**
 * 用途：约束 zoomOut 入参结构。
 * 使用范围：本文件函数签名。
 * 解耦评估：类型放在 `*.types.ts`，遵守业务文件不定义类型的约束。
 */
import type { ZoomOutOptions } from "./protyle.zoomOut.types";

/**
 * 作用：补齐默认值，保持旧行为。
 * 意图：兼容未传参调用。
 * 调用时机：zoomOut 入口。
 * 问题/改进：当前仍直接修改入参对象，后续可评估改为返回新对象。
 */
const 应用默认参数 = (options: ZoomOutOptions): void => {
    // 调用方未显式传值时，沿用历史默认行为：开启回退栈。
    if (typeof options.isPushBack === "undefined") {
        options.isPushBack = true;
    }
    // 调用方未显式传值时，默认不强制重载当前层级文档。
    if (typeof options.reload === "undefined") {
        options.reload = false;
    }
    // 浮窗上下文：非根文档操作需清除面包屑的 context 激活态，对应上游 cb1e67b
    if (options.id !== options.protyle.block.rootID) {
        options.protyle.breadcrumb?.element.parentElement.querySelector('[data-type="context"]')?.classList.remove("block__icon--active");
    }
};

/**
 * 作用：修正 block popover 的 pin 状态。
 * 意图：避免图标与状态字段不一致。
 * 调用时机：zoomOut 入口阶段。
 * 问题/改进：依赖当前 DOM 结构，后续可由状态层统一控制。
 */
const 修正弹层Pin状态 = (options: ZoomOutOptions): void => {
    const blockPanelElement = hasClosestByClassName(options.protyle.element, "block__popover", true);
    if (!blockPanelElement) {
        return;
    }

    const pinElement = blockPanelElement.querySelector('[data-type="pin"]');
    if (!pinElement) {
        return;
    }

    if (blockPanelElement.getAttribute("data-pin") === "true") {
        return;
    }

    pinElement.setAttribute("aria-label", siyuanI18n.unpin);
    const useElement = pinElement.querySelector("use");
    if (useElement) {
        useElement.setAttribute("xlink:href", "#iconUnpin");
    }
    blockPanelElement.setAttribute("data-pin", "true");
};

/**
 * 作用：尝试复用当前已渲染焦点。
 * 意图：目标已在当前页面时避免重复请求。
 * 调用时机：主请求前。
 * 问题/改进：依赖面包屑 active 判断，未来可引入更明确的状态源。
 */
const 尝试复用已渲染焦点 = (options: ZoomOutOptions): boolean => {
    if (options.reload) {
        return false;
    }

    const breadcrumbHLElement = options.protyle.breadcrumb?.element.querySelector(".protyle-breadcrumb__item--active");
    if (!breadcrumbHLElement) {
        return false;
    }

    if (breadcrumbHLElement.getAttribute("data-node-id") !== options.id) {
        return false;
    }

    if (options.id === options.protyle.block.rootID) {
        return true;
    }

    const targetId = options.focusId || options.id;
    const focusElement = options.protyle.wysiwyg.element.querySelector(`[data-node-id="${targetId}"]`);
    if (!focusElement) {
        return false;
    }

    focusBlock(focusElement);
    focusElement.scrollIntoView();
    return true;
};

/**
 * 作用：同步移动端文档状态与回退栈。
 * 意图：保持移动端返回链路一致。
 * 调用时机：主请求前。
 * 问题/改进：仍依赖全局 storage 对象，后续可进一步收敛状态入口。
 */
const 同步移动端文档信息 = (options: ZoomOutOptions): void => {
    if (!getSafeSiyuanMobile()?.editor) {
        return;
    }

    const storage = getSiyuanStorage();
    storage[Constants.LOCAL_DOCINFO] = { id: options.id };
    setStorageVal(Constants.LOCAL_DOCINFO, storage[Constants.LOCAL_DOCINFO]);

    if (!options.isPushBack) {
        return;
    }
    pushMobileBack();
};

/**
 * 作用：计算主文档请求大小。
 * 意图：根文档与子文档沿用历史加载策略。
 * 调用时机：主 `getDoc` 请求前。
 * 问题/改进：`dynamicLoadBlocks` 仍来自全局配置。
 */
const 获取主文档请求大小 = (options: ZoomOutOptions): number => {
    if (options.id !== options.protyle.block.rootID) {
        return Constants.SIZE_GET_MAX;
    }
    return getSiyuanConfig().editor.dynamicLoadBlocks;
};

/**
 * 作用：计算主文档响应的 onGet 动作集合。
 * 意图：集中管理动作映射，避免主流程散落分支。
 * 调用时机：主文档响应处理。
 * 问题/改进：动作仍是硬编码常量，后续可策略化。
 */
const 获取主文档动作 = (options: ZoomOutOptions): string[] => {
    const action: string[] = [Constants.CB_GET_HTML];
    if (!options.isPushBack) {
        action.push(Constants.CB_GET_UNUNDO);
    }
    if (options.id !== options.protyle.block.rootID) {
        action.push(Constants.CB_GET_ALL);
    }
    if (options.focusId) {
        action.push(Constants.CB_GET_FOCUS);
    }
    return action;
};

/**
 * 作用：无 focusId 且子文档返回时播放动画。
 * 意图：保留历史视觉反馈。
 * 调用时机：主流程收尾阶段。
 * 问题/改进：移除 class 仍依赖固定时长，后续可评估事件驱动结束。
 */
const 应用退出聚焦动画 = (options: ZoomOutOptions): void => {
    if (options.focusId) {
        return;
    }
    if (options.id === options.protyle.block.rootID) {
        return;
    }

    options.protyle.wysiwyg.element.classList.add("protyle-wysiwyg--animate");
    // 动画时长由现有样式约定为 365ms，这里保持同值移除 class。
    setTimeout(() => {
        options.protyle.wysiwyg.element.classList.remove("protyle-wysiwyg--animate");
    }, 365);
};

/**
 * 作用：同步大纲当前项并刷新反向链接图。
 * 意图：让侧栏状态跟随主编辑区。
 * 调用时机：主流程收尾阶段。
 * 问题/改进：当前仍遍历 outline 查找目标模型，后续可引入索引定位。
 */
const 更新大纲与反链图 = (options: ZoomOutOptions): void => {
    if (isMobile || !options.protyle.model) {
        return;
    }

    const allModels = getAllModels();
    for (const item of allModels.outline) {
        if (item.blockId !== options.protyle.block.rootID) {
            continue;
        }
        item.setCurrent(
            options.protyle.wysiwyg.element.querySelector(`[data-node-id="${options.focusId || options.id}"]`)
        );
    }
    updateBacklinkGraph(allModels, options.protyle);
};

/**
 * 作用：处理主文档响应后的后续流程。
 * 意图：把入口与异步收尾解耦。
 * 调用时机：主 `fetchPost` 回调。
 * 问题/改进：仍存在历史补偿分支，后续可继续收敛。
 */
const 处理主文档响应 = async (options: ZoomOutOptions, getResponse: IWebSocketData): Promise<void> => {
    onGet({
        data: getResponse,
        protyle: options.protyle,
        action: 获取主文档动作(options),
        scrollAttr: options.focusId ? {
            rootId: options.id,
            focusId: options.focusId,
        } : undefined,
        scrollPosition: options.focusId ? "start" : undefined,
        afterCB: options.callback,
        dataDocType: options.dataDocType,
    });

    const 已进入补偿分支 = await 处理ZoomOut焦点恢复(options);
    if (已进入补偿分支) {
        return;
    }

    应用退出聚焦动画(options);
    更新大纲与反链图(options);
};

/**
 * 作用：退出聚焦并切回目标层级文档。
 * 意图：统一处理主加载、焦点恢复和侧栏同步。
 * 调用时机：返回上级文档入口（如面包屑返回）。
 * 问题/改进：流程仍有历史兼容路径，后续可继续模块化。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const zoomOut = (options: ZoomOutOptions) => {
    if (options.protyle.options.backlinkData) {
        return;
    }

    应用默认参数(options);
    修正弹层Pin状态(options);

    if (尝试复用已渲染焦点(options)) {
        return;
    }

    同步移动端文档信息(options);

    fetchPost(
        "/api/filetree/getDoc",
        createZoomOutGetDocParams(options, {
            id: options.id,
            size: 获取主文档请求大小(options),
        }),
        (getResponse: IWebSocketData) => {
            void 处理主文档响应(options, getResponse);
        }
    );
};
