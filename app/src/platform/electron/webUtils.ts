/**
 * Electron webUtils 适配层
 *
 * 封装 webUtils 的延迟加载，避免模块顶层静态导入 electron。
 * 非 Electron 环境调用直接抛出错误。
 *
 * @module platform/electron/webUtils
 */

import { isElectron } from "../index";
import {nativeRequire} from "../nativeRequire";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _webUtils: any = null;

/** @同步豁免: 模块缓存访问，require 是同步 API */
function getWebUtils() {
    if (_webUtils) {
        return _webUtils;
    }
    if (!isElectron) {
        throw new Error("electron.webUtils is not available in browser environment");
    }
    _webUtils = nativeRequire<typeof import("electron")>("electron").webUtils;
    return _webUtils;
}

/** 获取 File 对象对应的本地文件路径 */
/** @同步豁免: 遗留代码 - 封装 Electron webUtils.getPathForFile 同步 API */
export function getPathForFile(file: File): string {
    return getWebUtils().getPathForFile(file);
}
