/**
 * @fileoverview 类型守卫
 */

/**
 * 判断元素是否为 HTMLInputElement
 */
export const isHTMLInputElement = (element: Element | null | undefined): element is HTMLInputElement => {
    return element instanceof HTMLInputElement;
};

/**
 * @AIDONE 此处应该放行SVG元素,函数名也需要相应改变,否则很多
 * <span id="searchPin" aria-label="钉住" class="block__icon block__icon--show ariaLabel" data-position="9south">
            <svg><use xlink:href="#iconPin"></use></svg>
        </span>
    形式的按钮元素就会无法响应点击
 * 判断元素是否为 HTMLElement 或 SVGElement
 */
export const isHTMLOrSVGElement = (element: unknown): element is HTMLElement | SVGElement => {
    return element instanceof HTMLElement || element instanceof SVGElement;
};
