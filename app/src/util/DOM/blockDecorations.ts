/**
 * 创建遮罩元素
 * @param blockElement 目标元素
 * @param color 遮罩颜色
 * @returns 创建的遮罩元素
 */
export const createBlockMask = (blockElement: Element, color: string): HTMLElement => {
    
    // 创建遮罩元素
    const maskElement = document.createElement("div");
    maskElement.className = "protyle-custom ai-chat-mask";
    maskElement.style.position = "absolute";
    maskElement.style.left = "0";
    maskElement.style.top = "0";
    maskElement.style.width = "100%";
    maskElement.style.height = "100%";
    maskElement.style.backgroundColor = color;
    maskElement.style.opacity = "0.3"; // 设置透明度，确保不影响内容可见性
    maskElement.style.pointerEvents = "none"; // 确保不影响鼠标事件
    maskElement.style.zIndex = "0"; // 设置适当的z-index，确保在内容之上但在对话框之下
    
    // 将遮罩元素添加到目标块元素的最后
    blockElement.appendChild(maskElement);
    
    return maskElement;
};

/**
 * 批量创建块遮罩
 * @param mainElement 主要目标元素
 * @param selectedElements 选中的元素数组
 * @param color 遮罩颜色
 * @returns 创建的所有遮罩元素数组
 */
export const createBlockMasks = (mainElement: Element, selectedElements: Element[], color: string): HTMLElement[] => {
    const maskElements: HTMLElement[] = [];
    
    // 为主元素创建遮罩
    const mainMask = createBlockMask(mainElement, color);
    maskElements.push(mainMask);
    
    // 为选中的元素创建遮罩（避免重复创建主元素的遮罩）
    if (selectedElements.length > 0) {
        selectedElements.forEach(selectedElement => {
            if (selectedElement !== mainElement) {
                const mask = createBlockMask(selectedElement, color);
                maskElements.push(mask);
            }
        });
    }
    
    return maskElements;
};

