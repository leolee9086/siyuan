/**
 * 链接菜单项模块
 *
 * 包含各种链接菜单项的创建函数。
 */
/**
 * 用途：生成事务更新时间字符串
 * 使用范围：删除/转换链接后更新节点 updated 字段
 * 解耦评估：通过 imports.ts 转发，第三方时间库不直接暴露给业务文件
 */
import { dayjs } from "./imports";
/**
 * 用途：设置复制/剪切动作的选区焦点
 * 使用范围：复制与剪切菜单项 click 回调
 * 解耦评估：通过 imports.ts 转发，编辑器焦点工具与业务编排解耦
 */
import { focusByRange } from "./imports";
/**
 * 用途：重命名 assets 资源
 * 使用范围：资源链接的“重命名”菜单项
 * 解耦评估：通过 imports.ts 转发，资源重命名实现可独立替换
 */
import { renameAsset } from "./imports";
/**
 * 用途：移除链接行内类型
 * 使用范围：“转换为文本”菜单项
 * 解耦评估：通过 imports.ts 转发，编辑器实现细节不泄露到业务层
 */
import { removeInlineType } from "./imports";
/**
 * 用途：复制链接地址到剪贴板
 * 使用范围：只读模式下复制链接地址菜单项
 * 解耦评估：通过 imports.ts 转发，剪贴板兼容实现可替换
 */
import { writeText } from "./imports";
/**
 * 用途：删除链接后恢复光标位置
 * 使用范围：删除菜单项完成后把焦点定位到 wbr
 * 解耦评估：通过 imports.ts 转发，选择器工具能力与业务分离
 */
import { focusByWbr } from "./imports";
/**
 * 用途：提交事务更新
 * 使用范围：删除、转换链接后写入事务记录
 * 解耦评估：通过 imports.ts 转发，事务系统边界更清晰
 */
import { updateTransaction } from "./imports";
/**
 * 用途：判断是否 Electron 桌面端
 * 使用范围：控制是否显示“复制资源文件”菜单项
 * 解耦评估：通过 imports.ts 转发，平台判断逻辑集中管理
 */
import { isElectron } from "./imports";
/**
 * 用途：读取系统配置中的操作系统信息
 * 使用范围：仅在 windows/darwin 时启用复制资源菜单
 * 解耦评估：通过 imports.ts 转发，配置访问实现可独立演进
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：读取全局菜单实例
 * 使用范围：追加所有链接菜单项
 * 解耦评估：通过 imports.ts 转发，菜单系统依赖统一入口
 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/**
 * 用途：读取国际化文案
 * 使用范围：菜单项 label 生成
 * 解耦评估：通过 imports.ts 转发，i18n 实现不直接耦合业务文件
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：生成“打开方式”菜单
 * 使用范围：链接地址存在时追加打开菜单
 * 解耦评估：通过 imports.ts 转发，公共菜单模块与业务层解耦
 */
import { openMenu } from "./imports";
/**
 * 用途：菜单项构造器
 * 使用范围：创建每个链接菜单项对象
 * 解耦评估：通过 imports.ts 转发，UI 组件依赖集中维护
 */
import { MenuItem } from "./imports";
/**
 * 用途：导出 assets 资源文件
 * 使用范围：资源链接菜单中的导出动作
 * 解耦评估：通过 imports.ts 转发，业务动作实现边界清晰
 */
import { exportAsset } from "./imports";
/**
 * 用途：复制 assets 资源文件到系统剪贴板
 * 使用范围：桌面端资源链接菜单中的复制动作
 * 解耦评估：通过 imports.ts 转发，平台能力实现可独立调整
 */
import {writeAssetToClipboard} from "./imports";
/**
 * 用途：约束链接菜单上下文类型
 * 使用范围：所有菜单项函数参数类型约束
 * 解耦评估：通过 imports.ts 转发类型，避免业务文件直接上跳父目录
 */
import type { LinkMenuContext } from "./imports";

// ────────────────────────────────────────────────────────────
// 菜单项创建函数
// ────────────────────────────────────────────────────────────

/**
 * 添加复制菜单项。
 * @同步豁免: UI构建 - 该函数在菜单创建阶段同步注册 item，异步化会破坏菜单渲染时序。
 */
export const 添加复制菜单项 = (linkElement: HTMLElement): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copy",
        label: siyuanI18n.copy,
        icon: "iconCopy",
        /** @简洁函数 菜单的click回调 */
        click() {
            const range = document.createRange();
            range.selectNode(linkElement);
            focusByRange(range);
            document.execCommand("copy");
        }
    }).element);
};

/**
 * 添加复制链接地址菜单项（只读模式）。
 * @同步豁免: UI构建 - 该函数用于同步追加只读菜单项，必须在同一渲染周期内完成。
 */
export const 添加复制链接地址菜单项 = (linkAddress: string | null): void => {
    if (!linkAddress) {
        return;
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "copyAHref",
        label: siyuanI18n.copyAHref,
        icon: "iconLink",
        /** @简洁函数 菜单的click回调 */
        click() {
            writeText(linkAddress);
        }
    }).element);
};

/**
 * 添加剪切菜单项。
 * @同步豁免: UI构建 - 菜单项注册必须同步完成以保证用户点击时立即可用。
 */
export const 添加剪切菜单项 = (linkElement: HTMLElement): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "cut",
        icon: "iconCut",
        label: siyuanI18n.cut,
        /** @简洁函数 菜单的click回调 */
        click() {
            const range = document.createRange();
            range.selectNode(linkElement);
            focusByRange(range);
            document.execCommand("cut");
        }
    }).element);
};

/**
 * 添加删除菜单项。
 * @同步豁免: UI构建 - 该函数在同步菜单构建阶段注册删除动作，不应引入异步时序。
 */
export const 添加删除菜单项 = (ctx: LinkMenuContext): void => {
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "remove",
        icon: "iconTrashcan",
        label: siyuanI18n.remove,
        /** @简洁函数 菜单的click回调 */
        click() {
            ctx.linkElement.insertAdjacentHTML("afterend", "<wbr>");
            ctx.linkElement.remove();
            ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
            updateTransaction(ctx.protyle, ctx.nodeElement, ctx.html);
            const toolbarRange = ctx.protyle.toolbar?.range;
            if (toolbarRange) {
                focusByWbr(ctx.nodeElement, toolbarRange);
            }
            ctx.html = ctx.nodeElement.outerHTML;
        }
    }).element);
};

/**
 * 添加重命名菜单项（仅资源文件）。
 * @同步豁免: UI构建 - 根据当前链接状态同步决定是否展示菜单项，保持菜单结构确定性。
 */
export const 添加重命名菜单项 = (linkAddress: string | null): void => {
    if (!linkAddress?.startsWith("assets/")) {
        return;
    }
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "rename",
        label: siyuanI18n.rename,
        icon: "iconEdit",
        /** @简洁函数 菜单的click回调 */
        click() {
            renameAsset(linkAddress);
        }
    }).element);
};

/**
 * 处理转换为引用的逻辑
 * @param ctx - 链接菜单上下文
 * @param inputElements - 输入元素列表
 */
const 执行转换为引用 = (ctx: LinkMenuContext, inputElements: NodeListOf<HTMLTextAreaElement>): void => {
    const 链接地址输入框 = inputElements[0];
    const 标题输入框 = inputElements[2];
    if (!链接地址输入框 || !标题输入框) {
        return;
    }

    ctx.linkElement.setAttribute("data-subtype", "s");
    const types = ctx.linkElement.getAttribute("data-type")?.split(" ") ?? [];
    types.push("block-ref");
    const aIndex = types.indexOf("a");
    // 若原始类型包含链接标记 a，需要在转为块引用时移除该标记，避免类型冲突。
    if (aIndex > -1) {
        types.splice(aIndex, 1);
    }
    ctx.linkElement.setAttribute("data-type", types.join(" "));
    ctx.linkElement.setAttribute("data-id", 链接地址输入框.value.replace("siyuan://blocks/", ""));
    链接地址输入框.value = "";
    标题输入框.value = "";
    ctx.linkElement.removeAttribute("data-href");
    ctx.linkElement.removeAttribute("data-title");
    ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(ctx.protyle, ctx.nodeElement, ctx.html);
    const toolbarRange = ctx.protyle.toolbar?.range;
    if (toolbarRange) {
        toolbarRange.selectNodeContents(ctx.linkElement);
        toolbarRange.collapse(false);
        focusByRange(toolbarRange);
    }
    ctx.html = ctx.nodeElement.outerHTML;
};

/**
 * 添加转换为引用菜单项（仅思源链接）。
 * @同步豁免: UI构建 - 菜单构建阶段需要同步判定并追加 item，确保用户看到完整菜单。
 */
export const 添加转换为引用菜单项 = (ctx: LinkMenuContext): void => {
    if (!ctx.linkAddress?.startsWith("siyuan://blocks/")) {
        return;
    }
    if (!ctx.inputElements) {
        return;
    }

    const inputElements = ctx.inputElements;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "turnIntoRef",
        label: `${siyuanI18n.turnInto} <b>${siyuanI18n.ref}</b>`,
        icon: "iconRef",
        /** @简洁函数 菜单的click回调 */
        click() {
            执行转换为引用(ctx, inputElements);
        }
    }).element);
};

/**
 * 处理转换为文本的逻辑
 * @param ctx - 链接菜单上下文
 * @param inputElements - 输入元素列表
 */
const 执行转换为文本 = (ctx: LinkMenuContext, inputElements: NodeListOf<HTMLTextAreaElement>): void => {
    const 链接地址输入框 = inputElements[0];
    const 标题输入框 = inputElements[2];
    if (!链接地址输入框 || !标题输入框) {
        return;
    }

    链接地址输入框.value = "";
    标题输入框.value = "";
    ctx.nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    removeInlineType(ctx.linkElement, "a", ctx.protyle.toolbar?.range);
    updateTransaction(ctx.protyle, ctx.nodeElement, ctx.html);
    ctx.html = ctx.nodeElement.outerHTML;
};

/**
 * 添加转换为文本菜单项。
 * @同步豁免: UI构建 - 同步注册菜单项以保证菜单渲染与行为绑定的一致性。
 */
export const 添加转换为文本菜单项 = (ctx: LinkMenuContext): void => {
    if (!ctx.inputElements) {
        return;
    }

    const inputElements = ctx.inputElements;
    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "turnIntoText",
        label: `${siyuanI18n.turnInto} <b>${siyuanI18n.text}</b>`,
        icon: "iconRefresh",
        /** @简洁函数 菜单的click回调 */
        click() {
            执行转换为文本(ctx, inputElements);
        }
    }).element);
};

/**
 * 添加链接相关菜单项（打开、导出等）。
 * @同步豁免: UI构建 - 菜单项需要在同一次菜单打开流程中同步拼装，避免异步导致顺序错乱。
 */
export const 添加链接操作菜单项 = (ctx: LinkMenuContext): void => {
    if (!ctx.linkAddress) {
        return;
    }

    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_2", type: "separator" }).element);
    openMenu(ctx.protyle.app, ctx.linkAddress, false, true);

    // 仅 assets 链接才需要显示导出/复制资源文件相关菜单项。
    if (!ctx.linkAddress.startsWith("assets/")) {
        return;
    }

    getSiyuanGlobalMenusMenu().append(new MenuItem(exportAsset(ctx.linkAddress)).element);

    const canCopyAsset = isElectron && ["windows", "darwin"].includes(getSiyuanConfig().system.os);
    // 仅 Electron 桌面端（Windows/macOS）支持复制资源文件到系统剪贴板。
    if (!canCopyAsset) {
        return;
    }

    getSiyuanGlobalMenusMenu().append(new MenuItem(writeAssetToClipboard(ctx.linkAddress)).element);
};

/**
 * 添加编辑操作菜单项（剪切、删除、重命名、转换等）。
 * @同步豁免: UI构建 - 编辑菜单项集合需要同步构建，保证可编辑态菜单立即完整可用。
 */
export const 添加编辑操作菜单项 = (ctx: LinkMenuContext): void => {
    添加剪切菜单项(ctx.linkElement);
    添加删除菜单项(ctx);
    添加重命名菜单项(ctx.linkAddress);
    添加转换为引用菜单项(ctx);
    添加转换为文本菜单项(ctx);
};
