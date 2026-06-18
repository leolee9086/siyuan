/**
 * 根据块类型获取对应的图标名称
 *
 * 作用：将 SiYuan 的块类型（NodeDocument、NodeParagraph 等）映射为图标 CSS 类名
 * 意图：提供统一的图标查询接口，避免编辑器各处分散的 type→icon 映射逻辑
 * 调用时机：编辑器渲染块图标、Gutter 菜单图标等场景
 * @同步豁免: UI构建 - 被模板字面量调用渲染 SVG 图标，必须同步返回字符串
 */

const ICON_MAP: Record<string, string> = {
    NodeDocument: "iconFile",
    NodeThematicBreak: "iconLine",
    NodeParagraph: "iconParagraph",
    NodeBlockquote: "iconQuote",
    NodeCallout: "iconCallout",
    NodeListItem: "iconListItem",
    NodeCodeBlock: "iconCode",
    NodeYamlFrontMatter: "iconCode",
    NodeTable: "iconTable",
    NodeBlockQueryEmbed: "iconSQL",
    NodeSuperBlock: "iconSuper",
    NodeMathBlock: "iconMath",
    NodeHTMLBlock: "iconHTML5",
    NodeWidget: "iconBoth",
    NodeIFrame: "iconGlobe",
    NodeVideo: "iconVideo",
    NodeAudio: "iconRecord",
    NodeAttributeView: "iconDatabase",
};

/**
 * 获取 Heading 类型的图标名称
 */
const headingIcon = (sub?: string) => "icon" + (sub ? sub.toUpperCase() : "Headings");

/**
 * 获取 List 类型的图标名称
 */
const listIcon = (sub?: string) => {
    if (sub === "t") {
        return "iconCheck";
    }
    if (sub === "o") {
        return "iconOrderedList";
    }
    return "iconList";
};

/**
 * 获取块类型对应的图标名称
 * @同步豁免: UI构建 - 被模板字面量调用渲染 SVG 图标，必须同步返回字符串
 */
export const getIconByType = (type: string, sub?: string) => {
    if (type === "NodeHeading") {
        return headingIcon(sub);
    }
    if (type === "NodeList") {
        return listIcon(sub);
    }
    return ICON_MAP[type] ?? "";
};
