/**
 * 用于移除 DOM 中所有指定类名
 * @param className 
 * @param doc 
 */
export const removeAllClass = (className: string, doc: Document | Element) => {
    for (const item of doc.querySelectorAll(`.${className}`)) {
        item.classList.remove(className);
    }
};
