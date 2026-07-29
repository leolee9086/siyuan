/** 用途：按复制类型生成剪贴板文本；使用范围：复制菜单动作；解耦评估：直达 Protyle 工具栏唯一实现。 */
import {copyTextByType} from "../../../protyle/toolbar/util";
/** 导出复制动作。 */
export {copyTextByType};

/** 用途：复制完成后恢复块焦点；使用范围：带焦点元素的复制菜单；解耦评估：直达 Protyle 选区唯一实现。 */
import {focusBlock} from "../../../protyle/util/selection";
/** 导出块焦点恢复。 */
export {focusBlock};

/** 用途：写入标准 Markdown 内容；使用范围：Markdown 复制动作；解耦评估：直达既有剪贴板实现。 */
import {writeText} from "../../../protyle/util/compatibility";
/** 导出剪贴板写入。 */
export {writeText};

/** 用途：读取标准 Markdown 内容；使用范围：Markdown 复制动作；解耦评估：保持当前根实现使用的请求协议。 */
import {fetchSyncPost} from "../../../util/network/fetch";
/** 导出同步风格请求。 */
export {fetchSyncPost};

/** 用途：判断是否添加浏览器 URL 复制项；使用范围：复制菜单平台差异；解耦评估：直达平台事实。 */
import {isElectron} from "../../../platform";
/** 导出 Electron 平台事实。 */
export {isElectron};

/** 用途：读取复制快捷键；使用范围：复制菜单展示；解耦评估：直达配置环境。 */
import {getSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出配置读取。 */
export {getSiyuanConfig};

/** 用途：读取复制菜单文案；使用范围：全部复制菜单项；解耦评估：直达 i18n 环境。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出菜单文案。 */
export {siyuanI18n};
