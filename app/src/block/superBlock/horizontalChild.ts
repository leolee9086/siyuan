/**
 * 定位横向超级块中的直属列子块。
 * @同步豁免: 需要绝对同步的 DOM 访问，布局操作必须读取当前层级。
 */
export const getHorizontalSuperBlockChild = (blockElement?: Element | null, boundaryElement?: Element) => {
    let currentElement = blockElement;
    while (currentElement?.parentElement && currentElement !== boundaryElement) {
        const parentElement = currentElement.parentElement;
        if (parentElement.getAttribute("data-type") === "NodeSuperBlock" &&
            parentElement.getAttribute("data-sb-layout") === "col") {
            return currentElement.hasAttribute("data-node-id") ? currentElement : undefined;
        }
        currentElement = parentElement;
    }
};
