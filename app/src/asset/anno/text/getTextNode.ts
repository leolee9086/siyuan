/**
 * 获取容器中第一个或最后一个具有内容的 PDF 文本层节点。
 * 选区坐标计算使用该纯 DOM 查询，无需依赖注释入口装配模块。
 * @同步豁免: 需要绝对同步的DOM访问 Range 构建要求在当前 Selection 状态下读取文本节点。
 */
export const getTextNode = (element: HTMLElement, isFirst: boolean) => {
    const spans = element.querySelectorAll('span[role="presentation"]');
    let index = isFirst ? 0 : spans.length - 1;
    while (spans[index]) {
        const target = spans[index];
        if (target?.textContent) {
            break;
        }
        if (isFirst) {
            index++;
            continue;
        }
        index--;
    }
    return spans[index];
};
