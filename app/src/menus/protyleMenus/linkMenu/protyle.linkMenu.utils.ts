/**
 * 链接菜单工具函数模块
 *
 * 包含链接编辑区域的HTML生成和事件绑定功能。
 */
/**
 * 用途：读取链接菜单相关常量
 * 使用范围：锚文本默认值与长度裁剪逻辑
 * 解耦评估：通过 imports.ts 转发，避免直接依赖上层 constants 路径
 */
import { Constants } from "./imports";
/**
 * 用途：显示复制成功提示
 * 使用范围：点击链接编辑区复制按钮后提示用户
 * 解耦评估：通过 imports.ts 转发，消息系统可独立演进
 */
import { showMessage } from "./imports";
/**
 * 用途：处理平台相关撤销按键行为
 * 使用范围：链接编辑输入框 keydown 事件
 * 解耦评估：通过 imports.ts 转发，平台兼容实现与业务解耦
 */
import { electronUndo } from "./imports";
/**
 * 用途：写入剪贴板文本
 * 使用范围：复制按钮点击后复制当前输入框内容
 * 解耦评估：通过 imports.ts 转发，兼容实现可替换
 */
import { writeText } from "./imports";
/**
 * 用途：运行时判断移动端
 * 使用范围：生成链接编辑区时决定输入框宽度
 * 解耦评估：通过 imports.ts 转发，端判断实现不暴露给业务文件
 */
import { isMobileDevice } from "./imports";
/**
 * 用途：获取全局菜单实例
 * 使用范围：处理 Enter/Escape 关闭菜单和追加菜单项
 * 解耦评估：通过 imports.ts 转发，菜单系统实现边界清晰
 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/**
 * 用途：获取国际化文案
 * 使用范围：链接编辑区域文案和复制提示文案
 * 解耦评估：通过 imports.ts 转发，i18n 依赖不直接渗透业务层
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：创建菜单项实例
 * 使用范围：构建链接编辑区域只读菜单项与分隔线
 * 解耦评估：通过 imports.ts 转发，UI 组件依赖集中收口
 */
import { MenuItem } from "./imports";
/**
 * 用途：约束链接菜单上下文类型
 * 使用范围：链接编辑区绑定与菜单项编排函数参数
 * 解耦评估：通过 imports.ts 转发类型，避免业务文件直接上跳父目录
 */
import type { LinkMenuContext } from "./imports";

// ────────────────────────────────────────────────────────────
// HTML 模板生成
// ────────────────────────────────────────────────────────────

/**
 * 生成链接编辑区域的 HTML 模板
 * 包含链接地址、锚文本、标题三个输入框
 */
/** @同步豁免: UI构建 - 该函数仅返回HTML字符串模板，不涉及任何异步操作，是纯粹的同步计算函数 */
export const 生成链接编辑区域HTML = (): string => {
    const width = isMobileDevice() ? "100%" : "360px";
    return `<div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.link}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea spellcheck="false" rows="1" 
style="margin:4px 0;width: ${width}" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.anchor}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="width: ${width};margin: 4px 0;" rows="1" class="b3-text-field"></textarea><div class="fn__hr"></div><div class="fn__flex">
    <span class="fn__flex-center">${siyuanI18n.title}</span>
    <span class="fn__space"></span>
    <span data-action="copy" class="block__icon block__icon--show b3-tooltips b3-tooltips__e fn__flex-center" aria-label="${siyuanI18n.copy}">
        <svg><use xlink:href="#iconCopy"></use></svg>
    </span>   
</div><textarea style="width: ${width};margin: 4px 0;" rows="1" class="b3-text-field"></textarea>`;
};

// ────────────────────────────────────────────────────────────
// 输入框事件处理
// ────────────────────────────────────────────────────────────

/** 处理输入框的通用键盘事件（Enter/Escape关闭菜单） */
const 处理关闭菜单按键 = (event: KeyboardEvent): boolean => {
    // 当用户按下 Enter 或 Escape 键且不在输入法组合状态时，关闭菜单
    if ((event.key === "Enter" || event.key === "Escape") && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        getSiyuanGlobalMenusMenu().remove();
        return true;
    }
    return false;
};

/** 处理链接输入框键盘事件 */
const 处理链接输入框按键 = (
    event: KeyboardEvent,
    nextInputElement: HTMLTextAreaElement
): void => {
    if (处理关闭菜单按键(event)) {
        return;
    }
    // 当用户按下 Tab 键且不在输入法组合状态时，将焦点移动到下一个输入框
    if (event.key === "Tab" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        nextInputElement.focus();
        return;
    }
    electronUndo(event);
};

/** 处理锚文本输入框键盘事件 */
const 处理锚文本输入框按键 = (
    event: KeyboardEvent,
    prevInputElement: HTMLTextAreaElement,
    nextInputElement: HTMLTextAreaElement
): void => {
    if (处理关闭菜单按键(event)) {
        return;
    }
    // 当用户按下 Tab 键且不在输入法组合状态时，根据 Shift 键状态切换焦点
    if (event.key === "Tab" && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        const targetInput = event.shiftKey ? prevInputElement : nextInputElement;
        targetInput.focus();
        return;
    }
    electronUndo(event);
};

/** 处理标题输入框键盘事件 */
const 处理标题输入框按键 = (
    event: KeyboardEvent,
    prevInputElement: HTMLTextAreaElement
): void => {
    if (处理关闭菜单按键(event)) {
        return;
    }
    // 当用户按下 Shift+Tab 且不在输入法组合状态时，将焦点移动到上一个输入框
    if (event.key === "Tab" && event.shiftKey && !event.isComposing) {
        event.preventDefault();
        event.stopPropagation();
        prevInputElement.focus();
        return;
    }
    electronUndo(event);
};

/** 处理复制按钮点击 */
const 处理复制按钮点击 = (event: MouseEvent): void => {
    let target = event.target;
    while (target instanceof HTMLElement) {
        // 向上查找直到找到带有 copy 动作的按钮元素
        if (target.dataset?.action !== "copy") {
            target = target.parentElement;
            continue;
        }
        const textarea = target.parentElement?.nextElementSibling;
        if (!(textarea instanceof HTMLTextAreaElement)) {
            break;
        }
        writeText(textarea.value);
        showMessage(siyuanI18n.copied);
        break;
    }
};

// ────────────────────────────────────────────────────────────
// 输入区域绑定主函数
// ────────────────────────────────────────────────────────────

/**
 * 设置链接编辑输入区域的绑定逻辑
 * 包括初始化输入框值和绑定所有事件
 */
/** @同步豁免: 需要绝对同步的DOM访问 - 该函数直接操作DOM元素（设置value、innerHTML、添加事件监听器），必须在同步上下文中执行以确保DOM状态一致性 */
export const 绑定链接编辑区域 = (
    element: HTMLElement,
    ctx: LinkMenuContext
): NodeListOf<HTMLTextAreaElement> => {
    element.style.maxWidth = "none";
    const inputElements = element.querySelectorAll("textarea");

    const 链接输入框 = inputElements[0];
    const 锚文本输入框 = inputElements[1];
    const 标题输入框 = inputElements[2];

    if (!链接输入框 || !锚文本输入框 || !标题输入框) {
        return inputElements;
    }

    // 初始化链接地址输入框
    链接输入框.value = ctx.linkAddress ? Lute.UnEscapeHTMLStr(ctx.linkAddress) : "";
    链接输入框.addEventListener("keydown", (event) => {
        处理链接输入框按键(event, 锚文本输入框);
    });

    // 初始化锚文本输入框
    // https://github.com/siyuan-note/siyuan/issues/6798
    let anchor = ctx.linkElement.textContent?.replace(Constants.ZWSP, "") ?? "";
    const needsDefaultAnchor = !anchor && ctx.linkAddress;
    // 当锚文本为空且存在链接地址时，使用链接地址作为默认锚文本
    if (needsDefaultAnchor && ctx.linkAddress) {
        anchor = decodeURIComponent(ctx.linkAddress.replace("https://", "").replace("http://", ""));
    }
    const exceedsMaxLength = needsDefaultAnchor && anchor.length > Constants.SIZE_LINK_TEXT_MAX;
    if (exceedsMaxLength) {
        anchor = anchor.substring(0, Constants.SIZE_LINK_TEXT_MAX) + "...";
    }
    if (needsDefaultAnchor) {
        ctx.linkElement.innerHTML = Lute.EscapeHTMLStr(anchor);
    }
    锚文本输入框.value = anchor;

    // 处理中文输入法完成事件
    锚文本输入框.addEventListener("compositionend", () => {
        const value = 锚文本输入框.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
        ctx.linkElement.innerHTML = Lute.EscapeHTMLStr(value || "*");
    });

    锚文本输入框.addEventListener("input", () => {
        // compositionend 已处理输入法事件，这里只处理非输入法输入
        const value = 锚文本输入框.value.replace(/\n|\r\n|\r|\u2028|\u2029/g, "").trim();
        ctx.linkElement.innerHTML = Lute.EscapeHTMLStr(value) || "*";
    });

    锚文本输入框.addEventListener("keydown", (event) => {
        处理锚文本输入框按键(event, 链接输入框, 标题输入框);
    });

    // 初始化标题输入框
    标题输入框.value = Lute.UnEscapeHTMLStr(ctx.linkElement.getAttribute("data-title") || "");
    标题输入框.addEventListener("keydown", (event) => {
        处理标题输入框按键(event, 锚文本输入框);
    });

    // 复制按钮点击事件
    element.addEventListener("click", 处理复制按钮点击);

    return inputElements;
};

// ────────────────────────────────────────────────────────────
// 可编辑模式菜单项
// ────────────────────────────────────────────────────────────

/** 添加编辑模式下的所有菜单项 */
/** @同步豁免: UI构建 - 该函数构建菜单UI组件，直接操作DOM并依赖同步的菜单构造流程，需要同步执行以确保菜单正确渲染 */
export const 添加编辑模式菜单项 = (ctx: LinkMenuContext): void => {
    // 添加链接编辑区域
    let inputElements: NodeListOf<HTMLTextAreaElement> | undefined;

    getSiyuanGlobalMenusMenu().append(new MenuItem({
        id: "linkAndAnchorAndTitle",
        iconHTML: "",
        type: "readonly",
        label: 生成链接编辑区域HTML(),
        /** @简洁函数 简单的绑定回调，初始化输入区域 */
        bind(element) {
            inputElements = 绑定链接编辑区域(element, ctx);
            ctx.inputElements = inputElements;
        }
    }).element);

    getSiyuanGlobalMenusMenu().append(new MenuItem({ id: "separator_1", type: "separator" }).element);
};
