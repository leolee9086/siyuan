/**
 * 用途：集中管理 contentMenu 模块的外部依赖
 * 使用范围：contentMenu 目录下业务文件统一从此处导入依赖
 * 解耦评估：通过导入转发层收敛跨目录耦合，降低后续重构风险
 */

/**
 * 用途：生成事务更新时间
 * 使用范围：行内元素剪切/删除后写入 updated 字段
 * 解耦评估：第三方库依赖稳定，通过转发层隔离路径耦合
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 contentMenu 更新时间戳 */
export { dayjs };

/**
 * 用途：聚焦到指定 Range
 * 使用范围：复制、剪切、粘贴相关操作前恢复编辑器焦点
 * 解耦评估：编辑器选区能力通过转发层集中接入
 */
import {focusByRange} from "../../../protyle/util/selection";
/** 导出 focusByRange 供内容菜单焦点控制 */
export { focusByRange };

/**
 * 用途：读取菜单常量
 * 使用范围：设置菜单 data-name 标识
 * 解耦评估：常量依赖稳定，通过转发层降低路径耦合
 */
import { Constants } from "../../../constants";
/** 导出 Constants 供内容菜单读取常量 */
export { Constants };

/**
 * 用途：判断是否移动端
 * 使用范围：移动端分支使用工具栏内容菜单
 * 解耦评估：平台判断能力通过转发层统一入口
 */
import { isMobile } from "../../../platform";
/** 导出 isMobile 供内容菜单端分支判断 */
export { isMobile };

/**
 * 用途：触发插件菜单事件
 * 使用范围：内容菜单构建完成后通知插件追加菜单项
 * 解耦评估：事件总线能力通过转发层统一，便于替换实现
 */
import { emitOpenMenu } from "../../../plugin/menu/emitOpenMenu.factory";
/** 导出 emitOpenMenu 供内容菜单插件扩展 */
export { emitOpenMenu };

/**
 * 用途：复制纯文本到剪贴板
 * 使用范围：复制纯文本菜单项
 * 解耦评估：兼容能力通过转发层使用，避免业务直接耦合平台细节
 */
import { copyPlainText } from "../../../protyle/util/compatibility";
/** 导出 copyPlainText 供纯文本复制 */
export { copyPlainText };

/**
 * 用途：写入文本到剪贴板
 * 使用范围：行内 code/kbd 菜单复制动作
 * 解耦评估：兼容能力通过转发层使用，避免业务直接耦合平台细节
 */
import { writeText } from "../../../protyle/util/compatibility";
/** 导出 writeText 供行内菜单复制 */
export { writeText };

/**
 * 用途：读取剪贴板内容
 * 使用范围：粘贴菜单降级分支
 * 解耦评估：兼容能力通过转发层使用，避免业务直接耦合平台细节
 */
import { readClipboard } from "../../../protyle/util/compatibility";
/** 导出 readClipboard 供粘贴降级处理 */
export { readClipboard };

/**
 * 用途：向上查找指定标签祖先
 * 使用范围：识别行内元素与表格 caption 场景
 * 解耦评估：DOM 工具能力通过转发层接入，业务与工具解耦
 */
import { hasClosestByTag } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestByTag 供内容菜单节点判断 */
export { hasClosestByTag };

/**
 * 用途：执行富文本粘贴
 * 使用范围：粘贴菜单主流程
 * 解耦评估：粘贴能力通过转发层接入，便于统一维护
 */
import { paste } from "../../../protyle/util/paste";
/** 导出 paste 供内容菜单粘贴 */
export { paste };

/**
 * 用途：执行纯文本粘贴
 * 使用范围：粘贴为纯文本菜单项
 * 解耦评估：粘贴能力通过转发层接入，便于统一维护
 */
import { pasteAsPlainText } from "../../../protyle/util/paste";
/** 导出 pasteAsPlainText 供内容菜单纯文本粘贴 */
export { pasteAsPlainText };

/**
 * 用途：执行转义粘贴
 * 使用范围：粘贴转义菜单项
 * 解耦评估：粘贴能力通过转发层接入，便于统一维护
 */
import { pasteEscaped } from "../../../protyle/util/paste";
/** 导出 pasteEscaped 供内容菜单转义粘贴 */
export { pasteEscaped };

/**
 * 用途：获取编辑器 Range
 * 使用范围：复制/剪切/粘贴前定位当前块选区
 * 解耦评估：选区工具通过转发层接入，降低路径耦合
 */
import { getEditorRange } from "../../../protyle/util/selection";
/** 导出 getEditorRange 供内容菜单选区计算 */
export { getEditorRange };

/**
 * 用途：聚焦到 wbr 位置
 * 使用范围：行内元素删除后恢复光标
 * 解耦评估：选区工具通过转发层接入，降低路径耦合
 */
import { focusByWbr } from "../../../protyle/util/selection";
/** 导出 focusByWbr 供内容菜单删除后聚焦 */
export { focusByWbr };

/**
 * 用途：执行块内容全选
 * 使用范围：全选菜单项
 * 解耦评估：选区工具通过转发层接入，降低路径耦合
 */
import { selectAll } from "../../../protyle/util/selection";
/** 导出 selectAll 供内容菜单全选 */
export { selectAll };

/**
 * 用途：读取工具栏实例
 * 使用范围：移动端 showContent 与当前类型判断
 * 解耦评估：属性获取通过转发层接入，降低业务对 props 工具耦合
 */
import { getProtyleToolbar } from "../../../protyle/util/props.pick";
/** 导出 getProtyleToolbar 供内容菜单工具栏访问 */
export { getProtyleToolbar };

/**
 * 用途：读取 Lute 实例
 * 使用范围：行内元素复制/剪切时生成 Markdown
 * 解耦评估：属性获取通过转发层接入，降低业务对 props 工具耦合
 */
import { getProtyleLute } from "../../../protyle/util/props.pick";
/** 导出 getProtyleLute 供内容菜单转 Markdown */
export { getProtyleLute };

/**
 * 用途：提交事务更新
 * 使用范围：删除与剪切后持久化文档变更
 * 解耦评估：事务能力通过转发层接入，业务与底层实现解耦
 */
import { updateTransaction } from "../../../protyle/wysiwyg/transaction";
/** 导出 updateTransaction 供内容菜单提交事务 */
export { updateTransaction };

/**
 * 用途：构建菜单项实例
 * 使用范围：内容菜单追加各项操作
 * 解耦评估：组件能力通过转发层接入，UI 依赖集中管理
 */
import { MenuItem } from "../../Menu.Item";
/** 导出 MenuItem 供内容菜单创建菜单项 */
export { MenuItem };

/**
 * 用途：访问全局菜单单例
 * 使用范围：内容菜单清空、追加、弹出
 * 解耦评估：菜单能力通过转发层接入，依赖边界清晰
 */
import { getSiyuanGlobalMenus } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenus 供内容菜单访问单例 */
export { getSiyuanGlobalMenus };

/**
 * 用途：获取国际化文案
 * 使用范围：内容菜单文案显示
 * 解耦评估：i18n 能力通过转发层接入，来源统一
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供内容菜单文案渲染 */
export { siyuanI18n };

/**
 * 用途：读取用户配置
 * 使用范围：复制纯文本快捷键与粘贴行为判断
 * 解耦评估：配置能力通过转发层接入，来源统一
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig 供内容菜单读取配置 */
export { getSiyuanConfig };

/**
 * 用途：读取当前全局 Selection
 * 使用范围：复制纯文本时获取选中内容
 * 解耦评估：DOM 全局能力通过转发层接入，降低跨层耦合
 */
import { getSelection } from "../../../util/DOM/selection/range.global";
/** 导出 getSelection 供内容菜单读取选区 */
export { getSelection };

/**
 * 用途：内容菜单上下文类型
 * 使用范围：内容菜单构建流程上下文传递
 * 解耦评估：类型定义集中在父目录复用，通过转发层避免业务文件上跳目录
 */
import type { IContentMenuContext } from "../protyle.types";
/** 导出 IContentMenuContext 供 contentMenu 类型约束 */
export type { IContentMenuContext };

/**
 * 用途：行内菜单上下文类型
 * 使用范围：行内元素菜单辅助函数参数约束
 * 解耦评估：类型定义集中在父目录复用，通过转发层避免业务文件上跳目录
 */
import type { IInlineMenuContext } from "../protyle.types";
/** 导出 IInlineMenuContext 供 contentMenu 类型约束 */
export type { IInlineMenuContext };

/**
 * 用途：添加表格菜单项
 * 使用范围：可编辑表格块的右键菜单扩展
 * 解耦评估：菜单扩展通过转发层接入，避免业务文件直接跨目录导入
 */
import { 添加表格菜单 } from "../editorMenu/protyle.tableMenu";
/** 导出 添加表格菜单 供 contentMenu 追加表格菜单 */
export { 添加表格菜单 };
