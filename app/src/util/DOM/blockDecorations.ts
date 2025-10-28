/**
 * 创建遮罩元素
 * @param element 目标元素
 * @param color 遮罩颜色
 * @returns 创建的遮罩元素
 */
export const createBlockMask = (element: Element, color: string): HTMLElement => {
    
    // 创建遮罩元素
    const maskElement = document.createElement('div');
    maskElement.className = 'protyle-custom ai-chat-mask';
    maskElement.style.position = 'absolute';
    maskElement.style.left = '0';
    maskElement.style.top = '0';
    maskElement.style.width = '100%';
    maskElement.style.height = '100%';
    maskElement.style.backgroundColor = color;
    maskElement.style.opacity = '0.3'; // 设置透明度，确保不影响内容可见性
    maskElement.style.pointerEvents = 'none'; // 确保不影响鼠标事件
    maskElement.style.zIndex = '0'; // 设置适当的z-index，确保在内容之上但在对话框之下
    
    // 将遮罩元素添加到目标块元素的最后
    element.appendChild(maskElement);
    
    return maskElement;
};