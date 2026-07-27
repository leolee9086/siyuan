/** 用途：日期格式化；使用范围：微信提醒属性；解耦评估：直达第三方包。 */
import * as dayjs from "dayjs";
/** 导出日期格式化实现。 */
export {dayjs};
/** 用途：恢复选区；使用范围：属性对话框销毁；解耦评估：直达唯一 Protyle 选区实现。 */
import {focusByRange} from "../../../protyle/util/selection";
/** 导出选区恢复。 */
export {focusByRange};
/** 用途：属性协议与对话框常量；使用范围：属性筛选和 Dialog 身份；解耦评估：静态领域值。 */
import {Constants} from "../../../constants";
/** 导出应用常量。 */
export {Constants};
/** 用途：属性对话框；使用范围：完整 File Attribute UI；解耦评估：具体 UI 仅在呈现实现边界加载。 */
import {Dialog} from "../../../dialog";
/** 导出对话框实现。 */
export {Dialog};
/** 用途：属性错误提示；使用范围：自定义属性校验；解耦评估：直达共享消息呈现实现，调用时序属于该 UI 行为。 */
import {showMessage} from "../../../dialog/message";
/** 导出消息提示。 */
export {showMessage};
/** 用途：查询已打开编辑器；使用范围：复用目标根文档实例；解耦评估：直达 Layout 查询。 */
import {getAllEditor} from "../../../layout/getAll";
/** 导出编辑器查询。 */
export {getAllEditor};
/** 用途：完整 Protyle 领域表面；使用范围：ghost 编辑器生命周期；解耦评估：纯类型不加载具体 class。 */
import type {ProtyleDomain} from "../../../protyle/protyle.types";
/** 导出完整 Protyle 类型。 */
export type {ProtyleDomain};
/** 用途：渲染数据库属性；使用范围：数据库属性页签；解耦评估：直达 AV 属性唯一渲染实现。 */
import {renderAVAttribute} from "../../../protyle/render/av/blockAttr";
/** 导出数据库属性渲染。 */
export {renderAVAttribute};
/** 用途：隐藏选区浮层；使用范围：属性对话框销毁；解耦评估：直达唯一 Protyle UI 实现。 */
import {hideElements} from "../../../protyle/ui/hideElements";
/** 导出局部元素隐藏。 */
export {hideElements};
/** 用途：移动平台判断；使用范围：Dialog 宽度；解耦评估：直达平台事实。 */
import {isMobile} from "../../../util/platform/functions";
/** 导出移动平台判断。 */
export {isMobile};
/** 用途：读取编辑器配置；使用范围：拼写检查；解耦评估：直达环境访问器。 */
import {getSiyuanConfig} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出配置读取。 */
export {getSiyuanConfig};
/** 用途：属性对话框文案；使用范围：全部标签与操作；解耦评估：直达 i18n 环境。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出属性文案。 */
export {siyuanI18n};
/** 用途：DOM 元素收窄；使用范围：属性 Dialog 查询；解耦评估：直达共享守卫。 */
import {isHTMLInputElement, isHTMLElement} from "../../../util/DOM/element.guard";
/** 导出 DOM 元素守卫。 */
export {isHTMLInputElement};
/** 导出通用 HTML 元素守卫。 */
export {isHTMLElement};
/** 用途：转义属性名；使用范围：无效属性提示；解耦评估：无状态纯函数，直达共享实现。 */
import {escapeHtml} from "../../../util/DOM/escape";
/** 导出 HTML 转义。 */
export {escapeHtml};
/** 用途：属性名校验；使用范围：自定义属性创建；解耦评估：无状态纯函数，直达平台规则实现。 */
import {isValidCustomAttrName} from "../../../util/platform/functions";
/** 导出属性名校验。 */
export {isValidCustomAttrName};
/** 用途：菜单项；使用范围：书签候选列表；解耦评估：具体 UI 仅由该呈现边界实例化。 */
import {MenuItem} from "../../Menu.Item";
/** 导出菜单项实现。 */
export {MenuItem};
/** 用途：属性读写；使用范围：属性 Dialog；解耦评估：直达统一网络实现，保持现有回调顺序。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};
