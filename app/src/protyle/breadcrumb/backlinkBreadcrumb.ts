/** 用途：按块类型生成面包屑图标。使用范围：反链和嵌入块面包屑 HTML。解耦评估：直接依赖 Editor 稳定图标实现。 */
import {getIconByType} from "./imports";
/** 用途：查找面包屑所属嵌入块。使用范围：外观压缩策略。解耦评估：直接复用 Protyle DOM 查询唯一实现。 */
import {hasClosestByAttribute} from "./imports";
/** 用途：收窄面包屑末项 DOM 类型。使用范围：滚动位置计算。解耦评估：复用 DOM 基础守卫，避免类型断言。 */
import {isHTMLElement} from "./imports";

/** 生成反链或嵌入块使用的面包屑 HTML。 @同步豁免: UI构建 */
export const genBreadcrumb = (blockPaths: IBreadcrumb[], renderFirst: boolean, parentIndex?: number) => {
    if (1 > blockPaths.length) {
        return `<div contenteditable="false" style="border-top: ${parentIndex === 0 ? 0 : 1}px solid var(--b3-border-color);min-height: 0;width: 100%;" class="protyle-breadcrumb__bar"><span></span></div>`;
    }

    let html = "";
    for (const [index, item] of blockPaths.entries()) {
        if (index === 0 && !renderFirst) {
            continue;
        }
        html += `<span class="protyle-breadcrumb__item${index === blockPaths.length - 1 ? " protyle-breadcrumb__item--active" : ""}" data-id="${item.id}">
    <svg class="popover__block" data-id="${item.id}"><use xlink:href="#${getIconByType(item.type, item.subType)}"></use></svg>
    ${item.name ? `<span class="protyle-breadcrumb__text" title="${item.name}">${item.name}</span>` : ""}
</span>`;
        // 相邻路径项之间添加方向箭头，末项后不追加分隔符。
        if (index !== blockPaths.length - 1) {
            html += '<svg class="protyle-breadcrumb__arrow"><use xlink:href="#iconRight"></use></svg>';
        }
    }
    return `<div contenteditable="false" class="protyle-breadcrumb__bar protyle-breadcrumb__bar--nowrap">${html}</div>`;
};

/** 每轮压缩一个可选文字项；所有候选均已压缩时返回 true。 */
const compressNextBreadcrumbItem = (itemElements: Element[], isEmbed: boolean) => {
    for (const [index, itemElement] of itemElements.entries()) {
        if (index <= (isEmbed ? 0 : -1)) {
            continue;
        }
        // 找到首个未压缩项后立即结束本轮，让浏览器重新计算布局高度。
        if (!itemElement.classList.contains("protyle-breadcrumb__text--ellipsis")) {
            itemElement.classList.add("protyle-breadcrumb__text--ellipsis");
            return false;
        }
        // 最后一项已经压缩表示没有更多候选，通知外层停止高度收敛循环。
        if (index === itemElements.length - 1) {
            return true;
        }
    }
    return true;
};

/** 压缩过高的面包屑文字，并保持末项可见。 @同步豁免: 需要绝对同步的DOM访问 */
export const improveBreadcrumbAppearance = (element: HTMLElement) => {
    for (const item of element.querySelectorAll<HTMLElement>(".protyle-breadcrumb__bar")) {
        item.classList.remove("protyle-breadcrumb__bar--nowrap");
        const itemElements = Array.from(item.querySelectorAll(".protyle-breadcrumb__text"));
        if (itemElements.length === 0) {
            return;
        }
        let jump = false;
        const isEmbed = Boolean(hasClosestByAttribute(item, "data-type", "NodeBlockQueryEmbed"));
        while (item.scrollHeight > 30 && !jump && itemElements.length > 1) {
            jump = compressNextBreadcrumbItem(itemElements, isEmbed);
        }
        item.classList.add("protyle-breadcrumb__bar--nowrap");
        // 末项为 HTML 元素时将其滚动到可见区域，SVG 等节点不参与 offset 计算。
        if (isHTMLElement(item.lastElementChild)) {
            item.scrollLeft = item.lastElementChild.offsetLeft - item.clientWidth + 14;
        }
    }
};
