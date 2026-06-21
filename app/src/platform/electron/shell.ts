/**
 * Electron shell 适配层
 *
 * 封装 shell.openExternal / shell.openPath 的延迟加载，
 * 非 Electron 环境调用直接抛出错误。
 *
 * @module platform/electron/shell
 */

/** 用途：isElectron 环境检测标志。使用范围：shell 操作判断是否在 Electron 环境下执行。解耦评估：通过目录 imports.ts 转发可降低路径耦合。 */
import { isElectron } from "../index";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _shell: any = null;

/**
 * 获取缓存的 shell 模块引用。
 *
 * 作用：延迟加载 electron.shell 并缓存，避免模块顶层静态导入
 * 意图：将编译时条件导入转为运行时按需加载
 * 调用时机：shell 适配函数内部调用
 *
 * @throws 非 Electron 环境下抛出错误
 */
/** @同步豁免: 模块缓存访问，require 是同步 API */
function getShell() {
    if (_shell) {
        return _shell;
    }
    if (!isElectron) {
        throw new Error("electron.shell is not available in browser environment");
    }
    _shell = __non_webpack_require__("electron").shell;
    return _shell;
}

/**
 * 使用系统默认方式打开外部 URL。
 *
 * 作用：封装 shell.openExternal 的延迟加载
 * 意图：替代桌面端条件分支中的 shell.openExternal 调用
 * 调用时机：需要打开外部链接时（仅 Electron 环境）
 *
 * @throws 非 Electron 环境下抛出错误
 */
export async function openExternal(url: string) {
    await getShell().openExternal(url);
}

/**
 * 使用系统默认方式打开本地路径。
 *
 * 作用：封装 shell.openPath 的延迟加载
 * 意图：替代桌面端条件分支中的 shell.openPath 调用
 * 调用时机：需要打开本地文件或目录时（仅 Electron 环境）
 *
 * @throws 非 Electron 环境下抛出错误
 */
export async function openPath(path: string) {
    return getShell().openPath(path);
}
