/**
 * PDF.js 库相关的类型定义
 */

/**
 * PDF.js PixelsPerInch 常量接口
 */
export interface IPdfjsPixelsPerInch {
    /** PDF 到 CSS 单位的转换因子 */
    PDF_TO_CSS_UNITS: number;
}

/**
 * PDF.js 库的最小接口定义
 */
export interface IPdfjsLib {
    /** 像素/英寸转换常量 */
    PixelsPerInch: IPdfjsPixelsPerInch;
}
