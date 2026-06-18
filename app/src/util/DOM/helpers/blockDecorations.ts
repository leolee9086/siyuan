/**
 * 创建单个块级遮罩，用于在 AI 相关面板中临时标记当前目标块。
 * 调用时机：AI 菜单需要高亮主块或候选块时同步创建。
 * 问题/改进：当前仍依赖内联样式，后续如有统一遮罩组件可进一步收敛。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const createBlockMask = (blockElement: Element, color: string) => {
    const maskElement = document.createElement("div");
    maskElement.className = "protyle-custom ai-chat-mask";
    maskElement.style.position = "absolute";
    maskElement.style.left = "0";
    maskElement.style.top = "0";
    maskElement.style.width = "100%";
    maskElement.style.height = "100%";
    maskElement.style.backgroundColor = color;
    maskElement.style.opacity = "0.3";
    maskElement.style.pointerEvents = "none";
    maskElement.style.zIndex = "0";
    blockElement.appendChild(maskElement);
    return maskElement;
};

/**
 * 批量为主块和附属块创建遮罩，避免 AI 选择流程中遗漏视觉反馈。
 * 调用时机：AI 菜单根据当前主选区和附加选区组装遮罩时调用。
 * 问题/改进：当前通过数组顺序区分主遮罩与附属遮罩，如后续需要更多元信息可改成对象结构。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export const createBlockMasks = (mainElement: Element, selectedElements: Element[], color: string) => {
    const maskElements = [createBlockMask(mainElement, color)];
    for (const selectedElement of selectedElements) {
        const isMainElement = selectedElement === mainElement;
        if (isMainElement) {
            continue;
        }
        maskElements.push(createBlockMask(selectedElement, color));
    }
    return maskElements;
};
