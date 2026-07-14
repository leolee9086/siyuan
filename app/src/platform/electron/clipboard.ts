/**
 * Electron clipboard 适配层
 *
 * 封装 electron clipboard 的延迟加载，避免模块顶层静态导入 electron。
 * 非 Electron 环境调用直接抛出错误。
 *
 * @module platform/electron/clipboard
 */

/** 用途：isElectron 环境检测标志。使用范围：剪贴板操作判断是否在 Electron 环境下执行。解耦评估：通过目录 imports.ts 转发可降低路径耦合。 */
import { isElectron } from "../index";
import {nativeRequire} from "../nativeRequire";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _clipboard: any = null;

/** @同步豁免: 模块缓存访问，require 是同步 API */
function getClipboard() {
    if (_clipboard) {
        return _clipboard;
    }
    if (!isElectron) {
        throw new Error("electron.clipboard is not available in browser environment");
    }
    _clipboard = nativeRequire<typeof import("electron")>("electron").clipboard;
    return _clipboard;
}

/** 以指定格式读取剪贴板内容 */
/** @同步豁免: 遗留代码 - 封装 Electron clipboard.read 同步 API */
export function clipboardRead(format: string) {
    return getClipboard().read(format);
}
