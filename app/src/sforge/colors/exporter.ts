/** 用途：导出请求和提示；使用范围：色卡下载与工作区保存；解耦评估：通过颜色模块网关隔离基础网络和提示实现。 */
import {fetchPost, showMessage} from "./imports";
/** 用途：色卡颜色结构和布局类型；使用范围：渲染及导出；解耦评估：纯类型依赖。 */
import type {CardLayout, PaletteColor, RGB} from "./types";
/** 用途：对比文字和十六进制格式；使用范围：色卡标签绘制；解耦评估：颜色算法与画布渲染保持分离。 */
import {bestTextColor, rgbToHex} from "./colorEngine";

/** 在矩形色块上绘制颜色值标签。 */
const drawLabel = (context: CanvasRenderingContext2D, color: RGB, box: {x: number; y: number; width: number; height: number}) => {
    context.fillStyle = rgbToHex(color);
    context.fillRect(box.x, box.y, box.width, box.height);
    context.fillStyle = rgbToHex(bestTextColor(color));
    context.font = "600 18px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(rgbToHex(color), box.x + box.width / 2, box.y + box.height / 2);
};

/** 绘制色卡标题和白色底板。 */
const drawCardHeader = (context: CanvasRenderingContext2D, title: string, width: number) => {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, context.canvas.height);
    context.fillStyle = "#20252b";
    context.font = "700 28px sans-serif";
    context.textAlign = "left";
    context.fillText(title, 42, 54);
};

/** 绘制渐变布局的顶部色带。 */
const drawGradient = (context: CanvasRenderingContext2D, colors: PaletteColor[], width: number) => {
    if (colors.length < 2) {
        return;
    }
    const gradient = context.createLinearGradient(42, 82, width - 42, 82);
    for (let index = 0; index < colors.length; index++) {
        gradient.addColorStop(index / (colors.length - 1), rgbToHex(colors[index].rgb));
    }
    context.fillStyle = gradient;
    context.fillRect(42, 82, width - 84, 120);
};

/** 绘制圆形颜色项。 */
const drawRoundItem = (context: CanvasRenderingContext2D, item: PaletteColor, y: number) => {
    context.beginPath();
    context.fillStyle = rgbToHex(item.rgb);
    context.arc(90, y + 38, 36, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#20252b";
    context.font = "600 18px sans-serif";
    context.textAlign = "left";
    context.fillText(item.name || rgbToHex(item.rgb), 150, y + 38);
};

/** 绘制左侧色块、右侧名称布局项。 */
const drawLeftItem = (context: CanvasRenderingContext2D, item: PaletteColor, y: number) => {
    drawLabel(context, item.rgb, {x: 42, y, width: 260, height: 56});
    context.fillStyle = "#20252b";
    context.font = "600 18px sans-serif";
    context.textAlign = "left";
    context.fillText(item.name || rgbToHex(item.rgb), 332, y + 28);
};

/** 绘制右侧色块、左侧名称布局项。 */
const drawRightItem = (context: CanvasRenderingContext2D, item: PaletteColor, y: number) => {
    context.fillStyle = "#20252b";
    context.font = "600 18px sans-serif";
    context.textAlign = "right";
    context.fillText(item.name || rgbToHex(item.rgb), 428, y + 28);
    drawLabel(context, item.rgb, {x: 458, y, width: 260, height: 56});
};

/** 绘制默认全宽色块布局项。 */
const drawDefaultItem = (context: CanvasRenderingContext2D, item: PaletteColor, y: number) => {
    drawLabel(context, item.rgb, {x: 42, y, width: context.canvas.width - 84, height: 56});
};

/** 根据布局绘制一个颜色项。 */
const drawCardItem = (context: CanvasRenderingContext2D, item: PaletteColor, config: {layout: CardLayout; y: number}) => {
    const renderers = {
        default: drawDefaultItem,
        left: drawLeftItem,
        right: drawRightItem,
        round: drawRoundItem,
        gradient: drawDefaultItem,
    };
    renderers[config.layout](context, item, config.y);
};

/** 根据颜色和布局生成 PNG data URL，供预览、下载和工作区导出复用。 */
export const renderColorCard = (colors: PaletteColor[], layout: CardLayout = "default", title = "S-Forge Colors") => {
    const width = 760;
    const rowHeight = layout === "round" ? 104 : 72;
    const height = Math.max(260, 116 + colors.length * rowHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        return "";
    }
    drawCardHeader(context, title, width);
    if (layout === "gradient") {
        drawGradient(context, colors, width);
    }
    for (let index = 0; index < colors.length; index++) {
        drawCardItem(context, colors[index], {layout, y: 94 + index * rowHeight});
    }
    return canvas.toDataURL("image/png");
};

/** 触发浏览器下载一个 data URL 文件。 */
export const downloadDataUrl = (dataUrl: string, filename = `sforge-colors-${Date.now()}.png`) => {
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
};

/** 把 PNG data URL 上传到工作区导出接口，并在成功后打开文件地址。 */
export const exportDataUrlToWorkspace = (dataUrl: string, filename = `sforge-colors-${Date.now()}.png`) => {
    const [header, encoded] = dataUrl.split(",");
    if (!encoded) {
        return;
    }
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    const blob = new Blob([bytes], {type: header.match(/data:([^;]+)/)?.[1] || "image/png"});
    const formData = new FormData();
    formData.append("file", blob, filename);
    formData.append("type", "image/png");
    fetchPost("/api/export/exportAsFile", formData, response => {
        const file = response.data?.file;
        if (file) {
            window.open(file);
            return;
        }
        showMessage("色卡已生成，但没有获得工作区文件地址", 3000, "error");
    });
};
