/**
 * 生成随机颜色
 * @returns 随机生成的十六进制颜色值
 */

/**
 * 计算HSL颜色转换为RGB的分量值
 * @param n 颜色分量索引 (0, 8, 4)
 * @param h 色相值 (0-360)
 * @param a 调整系数
 * @param l 亮度值 (0-1)
 * @returns 十六进制颜色分量字符串
 */
const calculateColorComponent = (n: number, h: number, a: number, l: number): string => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
};

/**
 * 将HSL颜色值转换为十六进制颜色值
 * @param h 色相值 (0-360)
 * @param s 饱和度值 (0-100)
 * @param l 亮度值 (0-100)
 * @returns 十六进制颜色值
 */
const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    return `#${calculateColorComponent(0, h, a, l)}${calculateColorComponent(8, h, a, l)}${calculateColorComponent(4, h, a, l)}`;
};

export const genRandomColor = (): string => {
    // 生成柔和的随机颜色，避免过于鲜艳的颜色
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 30) + 20; // 20-50% 饱和度
    const lightness = Math.floor(Math.random() * 20) + 70; // 70-90% 亮度

    return hslToHex(hue, saturation, lightness);
};
