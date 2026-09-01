/** 用途：跨平台路径运算；使用范围：同目录路径和显示名领域；解耦评估：浏览器实现集中在此边界。 */
import * as browserPathModule from "path-browserify";
import {isElectron} from "../../../platform";

type PathModule = typeof import("path");

/** 同目录路径领域使用的浏览器安全 POSIX 路径实现。 */
export const path = browserPathModule as unknown as PathModule;

/** Electron 仅在实际原生宿主中按需取得 Windows 路径实现。 */
export const getOriginalPath = (): PathModule => {
    if (!isElectron) {
        return path;
    }
    return window.require("path") as PathModule;
};
