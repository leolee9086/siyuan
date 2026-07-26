/** 查找并收窄表单输入框；未匹配或元素类型错误时返回 null。 */
export const getInputElement = (parent: ParentNode, selector = "input") => {
    const element = parent.querySelector(selector);
    return element instanceof HTMLInputElement ? element : null;
};

/** 查找并收窄按钮；未匹配或元素类型错误时返回 null。 */
export const getButtonElement = (parent: ParentNode, selector: string) => {
    const element = parent.querySelector(selector);
    return element instanceof HTMLButtonElement ? element : null;
};
