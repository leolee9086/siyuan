/**
 * showRender 模块辅助函数
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";

/** 子类型到标题的映射 */
const 子类型标题映射: Record<string, () => string> = {
    abc: () => siyuanI18n.staff,
    echarts: () => siyuanI18n.chart,
    flowchart: () => "Flow Chart",
    graphviz: () => "Graphviz",
    mermaid: () => "Mermaid",
    plantuml: () => "UML"
};

/** 获取思维导图标题和占位符 */
function 获取思维导图配置(): { 标题: string; 占位符: string } {
    return {
        标题: siyuanI18n.mindmap,
        占位符: `- foo
  - bar
- baz`
    };
}

/** 获取数学公式标题 */
function 获取数学公式标题(types: string[]): string {
    return types.includes("NodeMathBlock")
        ? siyuanI18n.math
        : siyuanI18n["inline-math"];
}

/**
 * 根据渲染类型确定面板标题和占位符
 */
export function 确定渲染标题(
    subtype: string | null,
    types: string[],
    是否行内备注: boolean
): { 标题: string; 占位符: string } {
    // 优先检查特殊类型
    if (types.includes("NodeBlockQueryEmbed")) {
        return { 标题: siyuanI18n.blockEmbed, 占位符: "" };
    }

    if (是否行内备注) {
        return { 标题: siyuanI18n.memo, 占位符: "" };
    }

    // 思维导图特殊处理（有占位符）
    if (subtype === "mindmap") {
        return 获取思维导图配置();
    }

    // 数学公式特殊处理（需要判断块级或行内）
    if (subtype === "math") {
        return { 标题: 获取数学公式标题(types), 占位符: "" };
    }

    // 通过映射表查找
    const 获取标题 = subtype ? 子类型标题映射[subtype] : undefined;
    if (获取标题) {
        return { 标题: 获取标题(), 占位符: "" };
    }

    // 默认值
    return { 标题: "HTML", 占位符: "" };
}

/**
 * 获取文本框初始值
 */
export function 获取文本框初始值(
    renderElement: Element,
    types: string[],
    是否行内备注: boolean
): string {
    if (types.includes("NodeHTMLBlock")) {
        const htmlElement = renderElement.querySelector("protyle-html");
        const content = htmlElement?.getAttribute("data-content") ?? "";
        return Lute.UnEscapeHTMLStr(content);
    }

    if (是否行内备注) {
        const content = renderElement.getAttribute("data-inline-memo-content") ?? "";
        return Lute.UnEscapeHTMLStr(content);
    }

    const content = renderElement.getAttribute("data-content") ?? "";
    return Lute.UnEscapeHTMLStr(content);
}

/** 获取固定状态下的样式 */
function 获取固定样式(subElement: HTMLElement): { 宽度: string; 高度: string } | undefined {
    const textElement = subElement.querySelector(".b3-text-field");
    if (!textElement || !(textElement instanceof HTMLTextAreaElement)) {
        return undefined;
    }
    return {
        宽度: textElement.style.width,
        高度: textElement.style.height
    };
}

/**
 * 检查是否处于固定状态
 */
export function 检查固定状态(subElement: HTMLElement): {
    是否固定: boolean;
    固定样式?: { 宽度: string; 高度: string } | undefined;
    是否拖拽中: boolean;
    刷新按钮激活: boolean;
} {
    const pinElement = subElement.querySelector('[data-type="pin"]');
    const 是否固定 = pinElement?.getAttribute("aria-label") === siyuanI18n.unpin;

    const firstChild = subElement.firstElementChild;
    const 是否拖拽中 = 是否固定 && firstChild?.getAttribute("data-drag") === "true";

    const refreshBtn = subElement.querySelector('[data-type="refresh"]');
    const 刷新按钮激活 = !是否固定 || (refreshBtn?.classList.contains("block__icon--active") ?? true);

    // 使用条件展开避免 exactOptionalPropertyTypes 问题
    const 固定样式 = 是否固定 ? 获取固定样式(subElement) : undefined;
    return {
        是否固定,
        是否拖拽中,
        刷新按钮激活,
        ...(固定样式 !== undefined ? { 固定样式 } : {})
    };
}
