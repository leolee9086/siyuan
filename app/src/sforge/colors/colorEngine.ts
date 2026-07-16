/** 用途：颜色类型；使用范围：颜色计算和图片分析；解耦评估：纯类型依赖，不引入运行时模块。 */
import type {ExtractionMethod, ExtractionResult, PaletteColor, RGB} from "./types";
/** 用途：识别主题样式表节点；使用范围：主题变量扫描；解耦评估：DOM 类型判断独立在 guard 文件中。 */
import {isHTMLStyleElement} from "./color.guards";

/** 将数值限制在 RGB 通道范围内，供所有颜色转换复用。 */
const clamp = (value: number, min = 0, max = 255) => Math.min(max, Math.max(min, value));

/** 将 RGB 元组转换为标准大写十六进制颜色。 */
export const rgbToHex = (rgb: RGB) => `#${rgb.map(value => Math.round(clamp(value)).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** 解析 3/4/6/8 位十六进制颜色，忽略 alpha 通道以保持 RGB 统一模型。 */
export const hexToRgb = (value: string) => {
    const normalized = value.trim().replace(/^#/, "");
    if (!/^[0-9a-f]{3,8}$/i.test(normalized)) {
        return null;
    }
    const full = normalized.length === 3 || normalized.length === 4
        ? normalized.split("").map(item => item + item).join("")
        : normalized;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ] satisfies RGB;
};

/** 解析十六进制、rgb/rgba 或浏览器可识别的 CSS 颜色。 */
export const parseCssColor = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith("#")) {
        return hexToRgb(trimmed);
    }
    const rgbMatch = trimmed.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (rgbMatch) {
        return [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])] satisfies RGB;
    }
    const probe = document.createElement("span");
    probe.style.color = trimmed;
    if (!probe.style.color) {
        return null;
    }
    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();
    return parseCssColor(computed);
};

/** 将 RGB 转换为 CSS 颜色，并在需要时保留透明度。 */
export const rgbToCss = (rgb: RGB, alpha = 1) => alpha >= 0.999
    ? rgbToHex(rgb)
    : `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`;

/** 计算 HSV 的色相分量，使用卫语句避免颜色分支相互嵌套。 */
const calculateHsvHue = (values: number[], max: number, delta: number) => {
    if (max === values[0]) {
        return 60 * (((values[1] - values[2]) / delta) % 6);
    }
    if (max === values[1]) {
        return 60 * ((values[2] - values[0]) / delta + 2);
    }
    return 60 * ((values[0] - values[1]) / delta + 4);
};

/** 将 RGB 转换为 HSV，结果范围为色相 0-360、饱和度和值 0-1。 */
export const rgbToHsv = (rgb: RGB) => {
    const values = rgb.map(item => clamp(item) / 255);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const delta = max - min;
    const hue = delta > 0 ? calculateHsvHue(values, max, delta) : 0;
    return [(hue + 360) % 360, max === 0 ? 0 : delta / max, max];
};

/** 计算 HSL 的色相分量，供 rgbToHsl 使用。 */
const calculateHslHue = (values: number[], delta: number, max: number) => {
    if (max === values[0]) {
        return ((values[1] - values[2]) / delta) % 6;
    }
    if (max === values[1]) {
        return (values[2] - values[0]) / delta + 2;
    }
    return (values[0] - values[1]) / delta + 4;
};

/** 将 RGB 转换为 HSL，结果范围为色相 0-360、饱和度和亮度 0-1。 */
export const rgbToHsl = (rgb: RGB) => {
    const values = rgb.map(item => clamp(item) / 255);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const delta = max - min;
    const lightness = (max + min) / 2;
    if (delta === 0) {
        return [0, 0, lightness];
    }
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    const hue = calculateHslHue(values, delta, max);
    return [((hue * 60) + 360) % 360, saturation, lightness];
};

/** 把 sRGB 通道线性化，用于符合 WCAG 的相对亮度计算。 */
const linearize = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

/** 计算 RGB 颜色的相对亮度。 */
export const relativeLuminance = (rgb: RGB) => 0.2126 * linearize(rgb[0])
    + 0.7152 * linearize(rgb[1])
    + 0.0722 * linearize(rgb[2]);

/** 计算两个 RGB 颜色之间的 WCAG 对比度。 */
export const contrastRatio = (first: RGB, second: RGB) => {
    const a = relativeLuminance(first);
    const b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};

/** 为给定背景选择白色或黑色中对比度更高的前景色。 */
export const bestTextColor = (background: RGB) => contrastRatio(background, [255, 255, 255]) >= contrastRatio(background, [0, 0, 0])
    ? [255, 255, 255]
    : [0, 0, 0];

/** 返回可直接用于色卡和编辑器展示的前景/背景颜色组合。 */
export const contrastPair = (background: RGB) => ({
    background,
    foreground: bestTextColor(background),
});

/** 按色相优先、亮度其次排序颜色，保持输入数组不可变。 */
export const sortByHue = (colors: PaletteColor[]) => [...colors].sort((a, b) => {
    const hueA = rgbToHsl(a.rgb)[0];
    const hueB = rgbToHsl(b.rgb)[0];
    return hueA - hueB || relativeLuminance(a.rgb) - relativeLuminance(b.rgb);
});

/** 计算 RGB 欧氏距离。 */
const distanceEuclidean = (a: RGB, b: RGB) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0));

/** 计算 HSV 空间距离，同时处理环形色相差。 */
const distanceHsv = (a: RGB, b: RGB) => {
    const hsvA = rgbToHsv(a);
    const hsvB = rgbToHsv(b);
    const hueDistance = Math.min(Math.abs(hsvA[0] - hsvB[0]), 360 - Math.abs(hsvA[0] - hsvB[0])) / 360;
    return Math.sqrt(hueDistance ** 2 + (hsvA[1] - hsvB[1]) ** 2 + (hsvA[2] - hsvB[2]) ** 2);
};

/** 计算带亮度维度的余弦距离。 */
const distanceCosineLightness = (a: RGB, b: RGB) => {
    const luminanceA = 0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2];
    const luminanceB = 0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2];
    const first = [...a, luminanceA];
    const second = [...b, luminanceB];
    const dot = first.reduce((sum, value, index) => sum + value * second[index], 0);
    const normA = Math.sqrt(first.reduce((sum, value) => sum + value ** 2, 0));
    const normB = Math.sqrt(second.reduce((sum, value) => sum + value ** 2, 0));
    return normA === 0 || normB === 0 ? 1 : 1 - dot / (normA * normB);
};

/** 计算一组像素的平均颜色，空组使用黑色作为稳定回退值。 */
const mean = (pixels: RGB[]) => {
    if (pixels.length === 0) {
        return [0, 0, 0] satisfies RGB;
    }
    const total: RGB = [0, 0, 0];
    for (const pixel of pixels) {
        total[0] += pixel[0];
        total[1] += pixel[1];
        total[2] += pixel[2];
    }
    return [total[0] / pixels.length, total[1] / pixels.length, total[2] / pixels.length] satisfies RGB;
};

/** 去除重复颜色并限制结果数量，保持占比排序后的优先级。 */
const dedupeColors = (colors: PaletteColor[], count: number) => {
    const result: PaletteColor[] = [];
    const seen = new Set<string>();
    for (const item of colors) {
        const rgb: RGB = [Math.round(item.rgb[0]), Math.round(item.rgb[1]), Math.round(item.rgb[2])];
        const key = rgbToHex(rgb);
        if (!seen.has(key)) {
            seen.add(key);
            result.push({...item, rgb});
        }
        if (result.length >= count) {
            break;
        }
    }
    return result;
};

/** 根据取色方法选择距离函数。 */
const getDistance = (method: ExtractionMethod) => {
    if (method === "kmeans-hsv") {
        return distanceHsv;
    }
    if (method === "kmeans-cosine-lightness") {
        return distanceCosineLightness;
    }
    return distanceEuclidean;
};

/** 执行确定性 K-Means，并处理空簇、收敛上限和重复中心。 */
export const kMeans = (pixels: RGB[], count: number, method: ExtractionMethod) => {
    const source = pixels.slice(0, 24000);
    if (source.length === 0) {
        return [];
    }
    const distance = getDistance(method);
    const centers: RGB[] = [];
    for (let index = 0; index < count; index++) {
        const sourcePixel = source[Math.floor(index * source.length / count)];
        centers.push([sourcePixel[0], sourcePixel[1], sourcePixel[2]]);
    }
    const assignments = Array.from({length: source.length}, () => -1);
    for (let iteration = 0; iteration < 32; iteration++) {
        let changed = false;
        const buckets: RGB[][] = [];
        for (let index = 0; index < count; index++) {
            buckets.push([]);
        }
        for (let pixelIndex = 0; pixelIndex < source.length; pixelIndex++) {
            const pixel = source[pixelIndex];
            let target = 0;
            let best = Number.POSITIVE_INFINITY;
            for (let centerIndex = 0; centerIndex < centers.length; centerIndex++) {
                const current = distance(pixel, centers[centerIndex]);
                if (current < best) {
                    best = current;
                    target = centerIndex;
                }
            }
            if (assignments[pixelIndex] !== target) {
                changed = true;
                assignments[pixelIndex] = target;
            }
            buckets[target].push(pixel);
        }
        for (let index = 0; index < buckets.length; index++) {
            if (buckets[index].length > 0) {
                centers[index] = mean(buckets[index]);
            }
        }
        if (!changed) {
            break;
        }
    }
    const counts = Array.from({length: count}, () => 0);
    for (const index of assignments) {
        counts[index]++;
    }
    return dedupeColors(centers.map((rgb, index) => ({rgb, ratio: counts[index] / source.length}))
        .sort((a, b) => (b.ratio || 0) - (a.ratio || 0)), count);
};

/** 获取一组像素在指定 RGB 通道上的跨度。 */
const getChannelRange = (box: RGB[], channel: number) => Math.max(...box.map(pixel => pixel[channel]))
    - Math.min(...box.map(pixel => pixel[channel]));

/** 使用中位切分近似 MMCQ，按最大色彩跨度递归拆分像素盒。 */
const medianCut = (pixels: RGB[], count: number) => {
    const boxes: RGB[][] = [pixels.slice()];
    while (boxes.length < count) {
        const boxIndex = boxes.reduce((bestIndex, box, index) => {
            const range = Math.max(...[0, 1, 2].map(channel => getChannelRange(box, channel)));
            const bestRange = Math.max(...[0, 1, 2].map(channel => getChannelRange(boxes[bestIndex], channel)));
            return range > bestRange ? index : bestIndex;
        }, 0);
        const box = boxes[boxIndex];
        if (box.length < 2) {
            break;
        }
        const ranges = [0, 1, 2].map(channel => getChannelRange(box, channel));
        const channel = ranges.indexOf(Math.max(...ranges));
        box.sort((a, b) => a[channel] - b[channel]);
        const middle = Math.floor(box.length / 2);
        boxes.splice(boxIndex, 1, box.slice(0, middle), box.slice(middle));
    }
    const total = pixels.length;
    return boxes.map(box => ({rgb: mean(box), ratio: box.length / total}))
        .sort((a, b) => (b.ratio || 0) - (a.ratio || 0));
};

/** 以 16 级 RGB 直方图统计主色，作为 Color Thief 风格的本地实现。 */
const histogramDominant = (pixels: RGB[], count: number) => {
    const bins = new Map<string, {rgb: RGB; count: number}>();
    for (const pixel of pixels) {
        const rgb: RGB = [
            Math.floor(pixel[0] / 16) * 16 + 8,
            Math.floor(pixel[1] / 16) * 16 + 8,
            Math.floor(pixel[2] / 16) * 16 + 8,
        ];
        const key = rgb.join(",");
        const entry = bins.get(key);
        if (!entry) {
            bins.set(key, {rgb, count: 1});
            continue;
        }
        entry.count++;
    }
    return [...bins.values()].sort((a, b) => b.count - a.count).slice(0, count)
        .map(item => ({rgb: item.rgb, ratio: item.count / pixels.length}));
};

/** 将图片缩放采样为有限数量的 RGB 像素，并跳过近乎完全透明的像素。 */
export const sampleImagePixels = (image: HTMLImageElement, maxPixels = 24000) => {
    const canvas = document.createElement("canvas");
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) {
        return [];
    }
    const scale = Math.min(1, Math.sqrt(maxPixels / (width * height)));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", {willReadFrequently: true});
    if (!context) {
        return [];
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const pixels: RGB[] = [];
    for (let index = 0; index < data.length; index += 4) {
        if (data[index + 3] < 16) {
            continue;
        }
        pixels.push([data[index], data[index + 1], data[index + 2]]);
    }
    return pixels;
};

/** 对一张图片执行五种本地取色算法，统一返回可展示和可导出的结果。 */
export const extractImageColors = (image: HTMLImageElement, count: number) => {
    const pixels = sampleImagePixels(image);
    return [
        {method: "color-thief", colors: histogramDominant(pixels, count)},
        {method: "kmeans-cosine-lightness", colors: kMeans(pixels, count, "kmeans-cosine-lightness")},
        {method: "kmeans-euclidean", colors: kMeans(pixels, count, "kmeans-euclidean")},
        {method: "kmeans-hsv", colors: kMeans(pixels, count, "kmeans-hsv")},
        {method: "mmcq", colors: medianCut(pixels, count)},
    ] satisfies ExtractionResult[];
};

/** 扫描主题样式表中的 CSS 变量，生成可以复用的动态主题颜色。 */
export const getThemeColorTokens = () => {
    const result: PaletteColor[] = [];
    const seen = new Set<string>();
    for (const id of ["themeDefaultStyle", "themeStyle"]) {
        const style = document.getElementById(id);
        if (!isHTMLStyleElement(style) || !style.sheet) {
            continue;
        }
        for (const rule of Array.from(style.sheet.cssRules)) {
            if (!(rule instanceof CSSStyleRule)) {
                continue;
            }
            for (let index = 0; index < rule.style.length; index++) {
                const name = rule.style.item(index);
                if (!name.startsWith("--")) {
                    continue;
                }
                const value = rule.style.getPropertyValue(name).trim();
                const rgb = parseCssColor(value) || parseCssColor(getComputedStyle(document.documentElement).getPropertyValue(name));
                if (rgb && !seen.has(name)) {
                    seen.add(name);
                    result.push({rgb, name});
                }
            }
        }
    }
    return result;
};

/** 将取色算法标识转换为用户可读的中文标签。 */
export const extractionMethodLabel = (method: ExtractionMethod) => {
    const labels: Record<ExtractionMethod, string> = {
        "color-thief": "Color Thief",
        "kmeans-euclidean": "K-Means 欧氏距离",
        "kmeans-hsv": "K-Means HSV 距离",
        "kmeans-cosine-lightness": "K-Means 余弦 + 亮度",
        mmcq: "MMCQ 中位切分",
    };
    return labels[method];
};
