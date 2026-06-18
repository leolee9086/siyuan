/**
 * Electron webFrame 适配层
 *
 * 封装 webFrame 的延迟加载，避免模块顶层静态导入 electron。
 * 非 Electron 环境调用直接抛出错误。
 *
 * @module platform/electron/webFrame
 */

/** 用途：isElectron 环境检测标志。使用范围：webFrame 操作判断是否在 Electron 环境下执行。解耦评估：通过目录 imports.ts 转发可降低路径耦合。 */
import { isElectron } from "../index";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _webFrame: any = null;

/** @同步豁免: 模块缓存访问，require 是同步 API */
function getWebFrame() {
    if (_webFrame) {
        return _webFrame;
    }
    if (!isElectron) {
        throw new Error("electron.webFrame is not available in browser environment");
    }
    _webFrame = __non_webpack_require__("electron").webFrame;
    return _webFrame;
}

/** 设置页面缩放比例 */
/** @同步豁免: 遗留代码 - 封装 Electron webFrame.setZoomFactor 同步 API */
export function setZoomFactor(factor: number) {
    getWebFrame().setZoomFactor(factor);
}

/** 清除 webFrame 缓存 */
/** @同步豁免: 遗留代码 - 封装 Electron webFrame.clearCache 同步 API */
export function clearWebFrameCache() {
    getWebFrame().clearCache();
}
