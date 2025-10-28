/**
 * 生成随机颜色
 * @returns 随机生成的十六进制颜色值
 */

export const genRandomColor = (): string => {
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
