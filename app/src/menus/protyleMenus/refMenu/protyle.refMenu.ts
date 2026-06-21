/** 用途：隐藏干扰浮层；使用范围：菜单打开前隐藏 util/toolbar/hint；解耦评估：UI 协作逻辑集中维护。 */
import { hideElements } from "./imports";
/** 用途：查找当前元素所在块；使用范围：读取 node-id 与 outerHTML；解耦评估：DOM 工具复用，减少重复实现。 */
import { hasClosestBlock } from "./imports";
/** 用途：读取全局菜单容器；使用范围：append/popup/fullscreen/remove；解耦评估：菜单单例由环境层管理。 */
import { getSiyuanGlobalMenus } from "./imports";
/** 用途：读取流程常量；使用范围：设置菜单 data-name 与动作码；解耦评估：常量集中维护。 */
import { Constants } from "./imports";
/** 用途：菜单项构造器；使用范围：引用菜单各项动作创建；解耦评估：组件能力统一维护。 */
import { MenuItem } from "./imports";
/** 用途：平台判断；使用范围：移动端/桌面端菜单展示分支；解耦评估：平台能力集中在平台层。 */
import { isMobile } from "./imports";
/** 用途：触发插件扩展菜单；使用范围：引用菜单扩展入口；解耦评估：事件总线统一扩展协议。 */
import { emitOpenMenu } from "./imports";
/** 用途：写入剪贴板文本；使用范围：copy/cut 动作；解耦评估：剪贴板能力由兼容层封装。 */
import { writeText } from "./imports";
/** 用途：通过 wbr 恢复光标；使用范围：删除引用后恢复编辑位置；解耦评估：选区能力在工具层封装。 */
import { focusByWbr } from "./imports";
/** 用途：提交文档事务；使用范围：cut/remove 后持久化更新；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：更新时间字符串；使用范围：写入 updated 字段；解耦评估：第三方依赖通过 imports.ts 转发。 */
import { dayjs } from "./imports";
/** 用途：查找顶层 popover；使用范围：设置菜单 data-from 来源；解耦评估：DOM 工具复用降低路径耦合。 */
import { hasTopClosestByClassName } from "./imports";
/** 用途：读取文案；使用范围：copy/cut/remove/turnInto 等菜单 label；解耦评估：i18n 来源统一。 */
import { siyuanI18n } from "./imports";

/** 用途：anchor 子流程工具；使用范围：获取 refBlockId、创建 anchor 编辑项、removeCB 清理；解耦评估：按关注点拆分可降低主流程复杂度。 */
import { 获取引用目标ID, 获取引用目标IDs } from "./protyle.refMenu.anchor";
/** 用途：anchor 子流程工具；使用范围：创建 anchor 编辑项；解耦评估：输入交互逻辑单独维护便于测试。 */
import { 创建锚点编辑菜单项 } from "./protyle.refMenu.anchor";
/** 用途：anchor 子流程工具；使用范围：菜单关闭时补偿事务与焦点恢复；解耦评估：清理逻辑集中减少主流程噪音。 */
import { 处理菜单关闭清理 } from "./protyle.refMenu.anchor";
/** 用途：桌面端动作构建器；使用范围：openBy/refTab/分屏/backlinks/graph；解耦评估：桌面菜单逻辑独立成模块。 */
import { 追加桌面端引用菜单项 } from "./protyle.refMenu.desktop";
/** 用途：转换子菜单构建器；使用范围：turnInto 子菜单生成；解耦评估：转换动作独立成模块，便于后续扩展。 */
import { 创建转换子菜单 } from "./protyle.refMenu.transform";

/**
 * 作用：执行引用剪切。
 * 意图：复用 cut 的删除与事务逻辑。
 * 调用时机：cut 菜单项点击。
 * 问题/改进：与 remove 行为接近，后续可参数化合并。
 */
const 执行剪切引用 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    writeText(protyle.lute.BlockDOM2StdMd(refElement.outerHTML));
    refElement.insertAdjacentHTML("afterend", "<wbr>");
    refElement.remove();
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeElement, htmlState.oldHTML);
    htmlState.oldHTML = nodeElement.outerHTML;
    const toolbarRange = protyle.toolbar?.range;
    if (toolbarRange) {
        focusByWbr(nodeElement, toolbarRange);
    }
};

/**
 * 作用：执行引用删除。
 * 意图：复用 remove 行为，保持删除后事务与焦点一致。
 * 调用时机：remove 菜单项点击。
 * 问题/改进：与 cut 行为相似，后续可进一步收敛共用函数。
 */
const 执行删除引用 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    refElement.insertAdjacentHTML("afterend", "<wbr>");
    refElement.remove();
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeElement, htmlState.oldHTML);
    htmlState.oldHTML = nodeElement.outerHTML;
    const toolbarRange = protyle.toolbar?.range;
    if (toolbarRange) {
        focusByWbr(nodeElement, toolbarRange);
    }
};

/**
 * 作用：触发引用菜单插件扩展。
 * 意图：保留插件系统可扩展能力。
 * 调用时机：基础菜单项构建完成后。
 * 问题/改进：后续可增加扩展执行耗时监控。
 */
const 触发引用插件菜单 = (protyle: IProtyle, refElement: HTMLElement) => {
    // 仅存在插件系统时触发扩展，避免无意义事件分发。
    if (!protyle?.app?.plugins) {
        return;
    }
    emitOpenMenu({
        plugins: protyle.app.plugins,
        type: "open-menu-blockref",
        detail: {
            protyle,
            element: refElement,
        },
        separatorPosition: "top",
    });
};

/**
 * 作用：按端类型展示菜单。
 * 意图：移动端 fullscreen，桌面端 popup，保持历史交互一致。
 * 调用时机：菜单项构建完成后。
 * 问题/改进：桌面端偏移值 26 为历史常量，后续可提取配置。
 */
const 展示引用菜单 = (refElement: HTMLElement) => {
    if (isMobile) {
        getSiyuanGlobalMenus().menu.fullscreen();
        return;
    }
    const rect = refElement.getBoundingClientRect();
    getSiyuanGlobalMenus().menu.popup({
        x: rect.left,
        y: rect.top + 26,
        h: 26
    });
};

/**
 * 作用：执行引用复制。
 * 意图：将复制行为独立成命名函数，避免菜单配置里出现匿名函数并提升可读性。
 * 调用时机：copy 菜单项点击时。
 * 问题/改进：后续如需统一 copy/cut 的序列化格式，可与剪切逻辑继续收敛。
 */
const 执行复制引用 = (protyle: IProtyle, refElement: HTMLElement) => {
    const blockMarkdown = protyle.lute.BlockDOM2StdMd(refElement.outerHTML);
    const normalizedMarkdown = blockMarkdown.trim();
    writeText(normalizedMarkdown);
};

/**
 * 作用：追加 copy/cut/remove 菜单项。
 * 意图：将基础编辑动作集中，减少主函数分支代码。
 * 调用时机：主菜单构建后半段。
 * 问题/改进：后续可抽象为通用 inline menu action builder。
 */
const 追加基础编辑菜单项 = (
    protyle: IProtyle,
    id: string | null,
    nodeElement: HTMLElement,
    htmlState: { oldHTML: string },
    refElement: HTMLElement
) => {
    getSiyuanGlobalMenus().menu.append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        click: 执行复制引用.bind(null, protyle, refElement)
    }).element);
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "cut",
            label: siyuanI18n.cut,
            icon: "iconCut",
            click: 执行剪切引用.bind(null, protyle, id, nodeElement, htmlState, refElement)
        }).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "remove",
            label: siyuanI18n.remove,
            icon: "iconTrashcan",
            click: 执行删除引用.bind(null, protyle, id, nodeElement, htmlState, refElement)
        }).element);
    }
};

/**
 * 作用：构建并弹出块引用菜单。
 * 意图：统一处理引用编辑、打开方式、转换、复制剪切删除与插件扩展。
 * 调用时机：用户在块引用节点触发上下文菜单时。
 * 问题/改进：主流程已拆分子模块，后续可继续把基础编辑项抽到独立模块。
 */
/** @同步豁免: 需要绝对同步的DOM访问 */
export const refMenu = (protyle: IProtyle, refElement: HTMLElement) => {
    const nodeElement = hasClosestBlock(refElement);
    if (!nodeElement) {
        return;
    }
    hideElements(["util", "toolbar", "hint"], protyle);

    const refBlockIds = 获取引用目标IDs(refElement);
    // 多 ID 时，首个 ID 作为 anchor 编辑和旧版兼容的默认值
    const primaryId = refBlockIds[0] || "";
    const id = nodeElement.getAttribute("data-node-id");
    const htmlState = { oldHTML: nodeElement.outerHTML };

    getSiyuanGlobalMenus().menu.remove();
    getSiyuanGlobalMenus().menu.element.setAttribute("data-name", Constants.MENU_INLINE_REF);

    // 多 ID 目标选择区
    if (refBlockIds.length > 1) {
        const targetLabel = `(${refBlockIds.length} 个目标)`;
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            label: targetLabel,
            type: "readonly",
            id: "multi-target-label"
        }).element);
        const selected = new Set(refBlockIds);
        // 存储到 menu 实例上供桌面端回调读取
        (getSiyuanGlobalMenus().menu as any).selectedTargetIds = selected;
        for (const blockId of refBlockIds) {
            const item = new MenuItem({
                label: blockId,
                id: "target-" + blockId,
                icon: "iconCheck",
                click: () => {
                    if (selected.has(blockId)) {
                        selected.delete(blockId);
                        item.element.querySelector("use")?.setAttribute("xlink:href", "#iconEmpty");
                    } else {
                        selected.add(blockId);
                        item.element.querySelector("use")?.setAttribute("xlink:href", "#iconCheck");
                    }
                    // 不关闭菜单
                    return true;
                }
            });
            getSiyuanGlobalMenus().menu.append(item.element);
        }
        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_1", type: "separator" }).element);
    }

    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(创建锚点编辑菜单项(refElement, primaryId).element);
        getSiyuanGlobalMenus().menu.append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    }
    if (!isMobile) {
        追加桌面端引用菜单项(protyle, refBlockIds);
    }
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.append(new MenuItem({
            id: "turnInto",
            label: siyuanI18n.turnInto,
            icon: "iconRefresh",
            submenu: 创建转换子菜单(protyle, id, nodeElement, htmlState, refElement, primaryId)
        }).element);
    }
    追加基础编辑菜单项(protyle, id, nodeElement, htmlState, refElement);
    触发引用插件菜单(protyle, refElement);
    展示引用菜单(refElement);

    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    getSiyuanGlobalMenus().menu.data = refElement;
    getSiyuanGlobalMenus().menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");

    const inputElement = getSiyuanGlobalMenus().menu.element.querySelector("input");
    const 可编辑并且存在输入框 = !protyle.disabled && inputElement instanceof HTMLInputElement;
    if (可编辑并且存在输入框) {
        inputElement.select();
    }
    if (!protyle.disabled) {
        getSiyuanGlobalMenus().menu.removeCB = () => {
            处理菜单关闭清理(protyle, id, nodeElement, htmlState, refElement);
        };
    }
};
