/** 用途：恢复 Range 焦点。使用范围：移动路径对话框；解耦评估：稳定 Protyle 选区实现。 */
import {focusByRange} from "../../../protyle/util/selection";
/** 导出 Range 焦点恢复。 */
export {focusByRange};

/** 用途：写入持久化存储。使用范围：移动路径历史；解耦评估：稳定存储唯一实现。 */
import {setStorageVal} from "../../storage/setStorageVal";
/** 导出持久化存储写入。 */
export {setStorageVal};

/** 用途：Dialog class。使用范围：移动路径对话框及事件绑定；解耦评估：完整 Dialog 领域实现。 */
import {Dialog} from "../../../dialog";
/** 导出 Dialog class。 */
export {Dialog};

/** 用途：共享常量。使用范围：移动路径请求、历史和快捷键；解耦评估：稳定共享常量。 */
import {Constants} from "../../../constants";
/** 导出共享常量。 */
export {Constants};

/** 用途：读取运行时配置。使用范围：历史条数和移动行为；解耦评估：稳定环境边界。 */
import {getSiyuanConfig} from "../../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出运行时配置读取。 */
export {getSiyuanConfig};
/** 用途：读取运行时存储。使用范围：路径历史和笔记本列表；解耦评估：稳定环境边界。 */
import {getSiyuanStorage} from "../../siyuanEnvironments/getSiyuanConfig.environment";
/** 导出运行时存储读取。 */
export {getSiyuanStorage};

/** 用途：平台修饰键判断。使用范围：路径点击；解耦评估：Protyle 兼容层既有实现。 */
import {isOnlyMeta} from "../../../protyle/util/compatibility";
/** 导出平台修饰键判断。 */
export {isOnlyMeta};
/** 用途：快捷键提示渲染。使用范围：对话框模板；解耦评估：Protyle 兼容层既有实现。 */
import {updateHotkeyTip} from "../../../protyle/util/compatibility";
/** 导出快捷键提示渲染。 */
export {updateHotkeyTip};

/** 用途：HTMLElement 守卫。使用范围：路径点击；解耦评估：稳定 DOM 守卫。 */
import {isHTMLElement} from "../../DOM/element.guard";
/** 导出 HTMLElement 守卫。 */
export {isHTMLElement};

/** 用途：路径叶节点读取。使用范围：点击和键盘选择；解耦评估：相邻文件路径领域。 */
import {getLeaf} from "../pathName";
/** 导出路径叶节点读取。 */
export {getLeaf};
/** 用途：设置当前笔记本。使用范围：移动路径提交；解耦评估：相邻文件路径领域。 */
import {setNoteBook} from "../pathName";
/** 导出当前笔记本设置。 */
export {setNoteBook};

/** 用途：国际化文案。使用范围：移动路径 UI；解耦评估：稳定环境边界。 */
import {siyuanI18n} from "../../siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化文案。 */
export {siyuanI18n};

/** 用途：移动平台布尔事实。使用范围：点击后的输入框恢复；解耦评估：稳定平台边界。 */
import {isMobilePlatform} from "../../../platform";
/** 导出移动平台布尔事实。 */
export {isMobilePlatform};
/** 用途：移动环境查询。使用范围：对话框尺寸和模板；解耦评估：保留既有函数式环境语义。 */
import {isMobile} from "../../platform/functions";
/** 导出移动环境查询。 */
export {isMobile};
/** 用途：完整平台信息。使用范围：移动路径提交；解耦评估：稳定平台边界。 */
import {platform} from "../../../platform";
/** 导出完整平台信息。 */
export {platform};

/** 用途：Emoji 渲染。使用范围：笔记本与搜索结果；解耦评估：Emoji 纯渲染唯一实现。 */
import {unicode2Emoji} from "../../../emoji/emoji.render";
/** 导出 Emoji 渲染。 */
export {unicode2Emoji};

/** 用途：HTML 转义。使用范围：移动路径 UI；解耦评估：稳定 DOM 工具。 */
import {escapeHtml} from "../../DOM/escape";
/** 导出 HTML 转义。 */
export {escapeHtml};

/** 用途：异步内核请求。使用范围：路径搜索和移动；解耦评估：稳定网络基础设施。 */
import {fetchPost} from "../../network/fetch";
/** 导出异步内核请求。 */
export {fetchPost};

/** 用途：快捷键匹配。使用范围：移动路径键盘事件；解耦评估：稳定 Protyle 热键实现。 */
import {matchHotKey} from "../../../protyle/util/hotKey";
/** 导出快捷键匹配。 */
export {matchHotKey};

/** 用途：全局菜单环境。使用范围：历史选择；解耦评估：稳定环境边界。 */
import {getSiyuanGlobalMenus} from "../../siyuanEnvironments/getMenu.environment";
/** 导出全局菜单环境。 */
export {getSiyuanGlobalMenus};

/** 用途：菜单 class。使用范围：历史选择菜单；解耦评估：完整 Menu 实现边界。 */
import {Menu} from "../../../plugin/Menu";
/** 导出菜单 class。 */
export {Menu};

/** 用途：祖先元素查找。使用范围：历史选择；解耦评估：稳定 Protyle DOM 工具。 */
import {hasClosestByClassName} from "../../../protyle/util/hasClosest";
/** 导出祖先元素查找。 */
export {hasClosestByClassName};

/** 用途：Dialog 集合读取。使用范围：避免重复打开移动路径对话框；解耦评估：稳定环境边界。 */
import {getSiyuanDialogs} from "../../siyuanEnvironments/getDialog.environment";
/** 导出 Dialog 集合读取。 */
export {getSiyuanDialogs};
