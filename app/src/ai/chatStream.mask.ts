import { Dialog } from "../dialog";

/**
 * 生成随机颜色
 * @returns 随机生成的十六进制颜色值
 */
export const genMaskColor = (): string => {
    // 生成柔和的随机颜色，避免过于鲜艳的颜色
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 30) + 20; // 20-50% 饱和度
    const lightness = Math.floor(Math.random() * 20) + 70; // 70-90% 亮度
    
    // 将HSL转换为十六进制
    const hslToHex = (h: number, s: number, l: number): string => {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = (n: number) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `#${f(0)}${f(8)}${f(4)}`;
    };
    
    return hslToHex(hue, saturation, lightness);
};



/**
 * 为对话框设置背景色
 * @param dialog 对话框实例
 * @param color 背景颜色
 */
export const setDialogColor = (dialog: Dialog, color: string): void => {
    // 获取对话框容器元素
    const dialogContainer = dialog.element.querySelector('.b3-dialog__container');
    if (dialogContainer instanceof HTMLElement) {
        dialogContainer.style.backgroundColor = color;
        dialogContainer.style.opacity = '0.95'; // 设置轻微透明度，保持可读性
    }
};

/**
 * 移除遮罩元素
 * @param maskElement 要移除的遮罩元素
 */
export const removeBlockMask = (maskElement: HTMLElement): void => {
    if (maskElement && maskElement.parentNode) {
        maskElement.parentNode.removeChild(maskElement);
    }
};