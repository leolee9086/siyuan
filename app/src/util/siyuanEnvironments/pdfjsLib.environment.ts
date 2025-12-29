/**
 * PDF.js 库的环境封装
 * 
 * 提供对 window.pdfjsLib 的安全访问
 */

import type { IPdfjsLib } from "./pdfjsLib.types";

/**
 * 获取 PDF.js 库实例
 * @returns PDF.js 库实例
 */
export const getPdfjsLib = (): IPdfjsLib => {
    // window.pdfjsLib 在运行时由 PDF.js 库注入
    // 类型定义在 src/types/index.d.ts 中声明为 any
    // 这里通过 IPdfjsLib 接口提供类型安全访问
    return window.pdfjsLib;
};

/**
 * 获取 PDF 到 CSS 单位的转换因子
 * @returns PDF_TO_CSS_UNITS 转换因子
 */
export const getPdfToCssUnits = (): number => {
    return getPdfjsLib().PixelsPerInch.PDF_TO_CSS_UNITS;
};
