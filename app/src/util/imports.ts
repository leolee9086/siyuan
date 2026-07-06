// 跨目录依赖转发
/** 用途：应用常量定义。使用范围：uri 模块使用常量配置。解耦评估：通过 imports.ts 转发。 */
import { Constants } from "../constants";
/** 导出 Constants，供 util 模块使用 */
export { Constants };

/** 用途：桌面端打开文件。使用范围：uri 模块桌面端打开块文件。解耦评估：通过 imports.ts 转发。 */
import { openFile } from "../editor/util";
/** 导出 openFile，供 util 模块使用 */
export { openFile };

/** 用途：桌面端通过 ID 打开文件。使用范围：uri 模块桌面端处理块 URI。解耦评估：通过 imports.ts 转发。 */
import { openFileById } from "../editor/utils.openFileById";
/** 导出 openFileById，供 util 模块使用 */
export { openFileById };

/** 用途：移动端打开文件。使用范围：uri 模块移动端处理块 URI。解耦评估：通过 imports.ts 转发。 */
import { openMobileFileById } from "../mobile/editor";
/** 导出 openMobileFileById，供 util 模块使用 */
export { openMobileFileById };

/** 用途：运行时平台判断（Electron）。使用范围：uri 模块平台分支。解耦评估：平台基础设施。 */
import { isElectron } from "../platform";
/** 导出 isElectron，供 util 模块使用 */
export { isElectron };

/** 用途：运行时平台判断（移动端）。使用范围：uri 模块平台分支。解耦评估：平台基础设施。 */
import { isMobile } from "../platform";
/** 导出 isMobile，供 util 模块使用 */
export { isMobile };

/** 用途：Electron IPC 发送。使用范围：uri 模块块打开后前置窗口。解耦评估：通过本地封装替代 electron 直连。 */
import { ipcSend } from "../platform/electron/ipcRenderer";
/** 导出 ipcSend，供 util 模块使用 */
export { ipcSend };

/** 用途：应用实例类型。使用范围：uri 模块参数类型。解耦评估：类型导入。 */
import type { App } from "../index";
/** 导出 App 类型，供 util 模块使用 */
export type { App };
