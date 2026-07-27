/** 用途：提供创建笔记本对话框标识和 IPC 命令；使用范围：普通笔记本创建流程；解耦评估：网关直达协议声明。 */
import {Constants} from "../../../../constants";
/** 导出创建流程协议常量。 */
export {Constants};
/** 用途：创建标准对话框；使用范围：普通笔记本创建流程组合边界；解耦评估：具体类只在初始化边界使用。 */
import {Dialog} from "../../../../dialog";
/** 导出具体 Dialog 供创建组合边界实例化。 */
export {Dialog};
/** 用途：描述完整对话框实例；使用范围：创建流程内部事件绑定；解耦评估：完整抽象由双向契约校验，不依赖具体类。 */
import type {IDialog} from "../../../../dialog/dialog.types";
/** 导出完整 Dialog 抽象供内部行为依赖。 */
export type {IDialog};
/** 用途：校验并规范笔记本名称；使用范围：确认创建动作；解耦评估：网关直达名称规则唯一实现。 */
import {replaceFileName, validateName} from "../../../../editor/rename";
/** 导出名称规则能力。 */
export {replaceFileName};
/** 导出名称合法性校验。 */
export {validateName};
/** 用途：导入 Obsidian Vault；使用范围：Electron 普通笔记本导入选项；解耦评估：网关直达导入流程唯一实现。 */
import {importObsidianVault} from "../../../../menus/importObsidian";
/** 导出 Obsidian 导入流程。 */
export {importObsidianVault};
/** 用途：判断 Electron 宿主；使用范围：控制 Obsidian 导入入口；解耦评估：平台状态由唯一环境实现提供。 */
import {isElectron} from "../../../../platform";
/** 导出 Electron 平台标识。 */
export {isElectron};
/** 用途：打开原生目录选择器；使用范围：选择 Obsidian Vault；解耦评估：网关直达 Electron IPC 基础设施。 */
import {ipcInvoke} from "../../../../platform/electron/ipcRenderer";
/** 导出 Electron IPC 调用能力。 */
export {ipcInvoke};
/** 用途：发送创建及导入请求；使用范围：普通笔记本创建流程；解耦评估：网关直达网络唯一实现。 */
import {fetchPost} from "../../../network/fetch";
/** 导出网络请求能力。 */
export {fetchPost};
/** 用途：判断移动布局；使用范围：创建对话框宽度；解耦评估：网关直达平台环境入口。 */
import {isMobile} from "../../../platform/functions";
/** 导出移动平台判断。 */
export {isMobile};
/** 用途：读取创建流程文案；使用范围：普通笔记本对话框；解耦评估：网关直达国际化环境入口。 */
import {siyuanI18n} from "../../../siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化环境。 */
export {siyuanI18n};
/** 用途：读取已初始化的宿主 homeDir；使用范围：Obsidian 目录选择器；解耦评估：网关直达严格配置环境入口。 */
import {getSiyuanConfig, getSiyuanLanguages} from "../../../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格配置访问器。 */
export {getSiyuanConfig};
/** 导出严格语言表访问器供上游新增文案使用。 */
export {getSiyuanLanguages};
