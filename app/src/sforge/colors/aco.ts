/** 用途：ACO 颜色结构；使用范围：Adobe 色板导入导出；解耦评估：纯类型依赖，不绑定文件系统。 */
import type {PaletteColor, RGB} from "./types";

/** 检查 ACO 缓冲区中是否存在指定长度的数据。 */
const hasBytes = (view: DataView, offset: number, length: number) => offset >= 0 && offset + length <= view.byteLength;

/** 读取 ACO 使用的 UTF-16 大端字符串。 */
const readUtf16BE = (view: DataView, offset: number, units: number) => {
    let result = "";
    for (let index = 0; index < units; index++) {
        result += String.fromCharCode(view.getUint16(offset + index * 2, false));
    }
    return result;
};

/** 读取一个 ACO 名称字段，并在损坏数据上停止于安全偏移。 */
const readAcoName = (view: DataView, offset: number) => {
    if (!hasBytes(view, offset, 4)) {
        return {name: "", nextOffset: offset};
    }
    const nameLength = view.getUint32(offset, false);
    const nameBytes = nameLength * 2;
    if (nameLength === 0 || !hasBytes(view, offset + 4, nameBytes)) {
        return {name: "", nextOffset: offset + 4};
    }
    const text = readUtf16BE(view, offset + 4, nameLength - 1).replace(/\0$/, "");
    return {name: text, nextOffset: offset + 4 + nameBytes};
};

/** 读取 ACO 的一个版本段，支持 RGB 色彩空间和版本 2 名称。 */
const readAcoSection = (view: DataView, offset: number) => {
    if (!hasBytes(view, offset, 4)) {
        return null;
    }
    const version = view.getUint16(offset, false);
    const count = view.getUint16(offset + 2, false);
    let cursor = offset + 4;
    const colors: PaletteColor[] = [];
    for (let index = 0; index < count; index++) {
        if (!hasBytes(view, cursor, 10)) {
            break;
        }
        const colorSpace = view.getUint16(cursor, false);
        const first = view.getUint16(cursor + 2, false);
        const second = view.getUint16(cursor + 4, false);
        const third = view.getUint16(cursor + 6, false);
        cursor += 10;
        const name = version === 2 ? readAcoName(view, cursor) : null;
        cursor = name ? name.nextOffset : cursor;
        const color = colorSpace === 0 ? {
            rgb: [first / 257, second / 257, third / 257] satisfies RGB,
            ...(name?.name ? {name: name.name} : {}),
        } : null;
        if (color) {
            colors.push(color);
        }
    }
    return {colors, nextOffset: cursor, version};
};

/** 读取 ACO 色板；优先使用带名称的版本 2 段，并忽略不支持的色彩空间。 */
export const readAco = (buffer: ArrayBuffer) => {
    const view = new DataView(buffer);
    if (view.byteLength < 4) {
        return [];
    }
    const first = readAcoSection(view, 0);
    if (!first) {
        return [];
    }
    const second = first.version === 1 ? readAcoSection(view, first.nextOffset) : null;
    return second?.colors.length ? second.colors : first.colors;
};

/** 将 0-255 RGB 通道编码为 ACO 的 16 位单位。 */
const encodeChannel = (value: number) => Math.round(Math.min(255, Math.max(0, value)) * 257);

/** 写入一个 ACO 颜色段，按需要附加版本 2 的 Unicode 名称。 */
const writeColorRecords = (view: DataView, startOffset: number, colors: PaletteColor[], includeNames: boolean) => {
    let offset = startOffset;
    for (const item of colors) {
        view.setUint16(offset, 0, false);
        view.setUint16(offset + 2, encodeChannel(item.rgb[0]), false);
        view.setUint16(offset + 4, encodeChannel(item.rgb[1]), false);
        view.setUint16(offset + 6, encodeChannel(item.rgb[2]), false);
        view.setUint16(offset + 8, 0, false);
        offset += 10;
        if (!includeNames) {
            continue;
        }
        const name = item.name || "";
        view.setUint32(offset, name.length + 1, false);
        offset += 4;
        for (const char of name) {
            view.setUint16(offset, char.charCodeAt(0), false);
            offset += 2;
        }
        view.setUint16(offset, 0, false);
        offset += 2;
    }
    return offset;
};

/** 写入标准 ACO 文件，包含无名称版本 1 段和带名称版本 2 段以兼容设计工具。 */
export const writeAco = (colors: PaletteColor[]) => {
    const firstSectionLength = 4 + colors.length * 10;
    const namedLength = colors.reduce((sum, item) => sum + 4 + (item.name || "").length * 2 + 2, 0);
    const secondSectionLength = 4 + colors.length * 10 + namedLength;
    const buffer = new ArrayBuffer(firstSectionLength + secondSectionLength);
    const view = new DataView(buffer);
    view.setUint16(0, 1, false);
    view.setUint16(2, colors.length, false);
    const firstEnd = writeColorRecords(view, 4, colors, false);
    view.setUint16(firstEnd, 2, false);
    view.setUint16(firstEnd + 2, colors.length, false);
    writeColorRecords(view, firstEnd + 4, colors, true);
    return buffer;
};
