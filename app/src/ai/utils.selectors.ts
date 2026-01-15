


import { SelectorOperationConfig } from "./types";

/**
 * 1.选择一个元素中所有符合的元素
 * 2.根据上下文中的回调序列对选中的所有元素进行操作
 * 3.操作之前使用一个过滤函数进行过滤
 * 4.操作完成之后调用完成回调
 *
 * @param ctx 上下文对象，用于承载副作用和配置
 * @param inputElement 要在其中搜索的父元素
 * @param config 操作配置对象
 */
export const selectAllThenEach = (
    inputElement: HTMLElement,
    config: SelectorOperationConfig
): void => {
    // 1. 选择所有符合的元素
    const elements = inputElement.querySelectorAll(config.selector);

    // 2. 使用过滤函数进行过滤（如果提供）
    const elementsArray = Array.from(elements);
    const filteredElements = elementsArray.filter((element, index) => {
        return config.filterFn ? config.filterFn(element, index, elementsArray) : true;
    });

    // 3. 对每个过滤后的元素执行操作
    for (const [index, element] of filteredElements.entries()) {
        config.eachFn(element, index, elementsArray);
    }

    // 4. 操作完成后调用完成回调（如果提供）
    if (config.completeFn) {
        config.completeFn();
    }
};