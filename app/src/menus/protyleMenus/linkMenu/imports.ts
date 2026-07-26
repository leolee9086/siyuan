/**
 * 用途：集中管理 linkMenu 模块的外部依赖导入
 * 使用范围：linkMenu 目录下的业务文件通过本文件转发依赖
 * 解耦评估：通过单一转发层隔离跨目录耦合，便于后续替换实现并减少业务文件对上层结构的感知
 */

// 时间与编辑状态导入
/**
 * 用途：生成事务更新时间字符串
 * 使用范围：链接菜单删除、转换、保存改动时写入 updated 字段
 * 解耦评估：时间格式化属于基础能力，可抽象为时钟服务；当前依赖稳定且影响面小，先通过转发层隔离
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供链接菜单写入更新时间 */
export { dayjs };

// 编辑器基础能力导入
/**
 * 用途：将浏览器选区焦点恢复到指定 Range
 * 使用范围：复制、剪切、链接编辑结束后的焦点恢复
 * 解耦评估：编辑器核心能力，短期不适合注入替换；通过转发层降低直接耦合
 */
import { focusByRange } from "../../../ai/imports";
/** 导出 focusByRange 供链接菜单处理焦点 */
export { focusByRange };

/**
 * 用途：读取菜单常量标识
 * 使用范围：设置当前菜单 data-name、处理零宽字符等编辑器常量
 * 解耦评估：常量依赖稳定，直接引用成本低；通过转发层保持可维护性
 */
import { Constants } from "../../../constants";
/** 导出 Constants 供链接菜单读取常量 */
export { Constants };

/**
 * 用途：隐藏提示气泡
 * 使用范围：打开链接菜单前清理旧 tooltip
 * 解耦评估：UI 清理属于菜单生命周期动作，未来可统一到菜单生命周期钩子；当前转发已足够
 */
import { hideTooltip } from "../../../dialog/tooltip";
/** 导出 hideTooltip 供链接菜单清理提示气泡 */
export { hideTooltip };

/**
 * 用途：触发插件扩展菜单事件
 * 使用范围：链接菜单打开时向插件系统广播 open-menu-link
 * 解耦评估：插件扩展点需要稳定事件总线；通过转发层集中依赖边界
 */
import { emitOpenMenu } from "../../../plugin/menu/emitOpenMenu.factory";
/** 导出 emitOpenMenu 供链接菜单触发插件扩展 */
export { emitOpenMenu };

/**
 * 用途：隐藏 util/toolbar/hint 等浮层
 * 使用范围：链接菜单打开前清理界面干扰元素
 * 解耦评估：属于编辑器 UI 协作逻辑，后续可抽象为统一 UI 状态服务；当前保留转发
 */
import { hideElements } from "../../../protyle/ui/hideElements";
/** 导出 hideElements 供链接菜单清理浮层 */
export { hideElements };

/**
 * 用途：查找当前元素所在块级节点
 * 使用范围：链接菜单定位当前链接对应的块并读取 data-node-id
 * 解耦评估：DOM 工具函数本身可复用，已由基础模块提供；转发层用于减少业务文件路径耦合
 */
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestBlock 供链接菜单定位块节点 */
export { hasClosestBlock };

/**
 * 用途：向上查找带指定类名的顶层祖先
 * 使用范围：判断菜单来源是否来自浮窗块（popover）
 * 解耦评估：DOM 查找逻辑集中在工具模块更合理；转发层保证调用方结构稳定
 */
import { hasTopClosestByClassName } from "../../../protyle/util/hasClosest";
/** 导出 hasTopClosestByClassName 供链接菜单判断来源 */
export { hasTopClosestByClassName };

/**
 * 用途：提交编辑器事务
 * 使用范围：链接属性变更、删除、转换后写入事务以支持撤销重做
 * 解耦评估：事务系统是核心基础设施，暂不适合替换；通过转发层降低散落依赖
 */
import { updateTransaction } from "../../../protyle/wysiwyg/transaction";
/** 导出 updateTransaction 供链接菜单写入事务 */
export { updateTransaction };

/**
 * 用途：提供 Electron 桌面端判断能力
 * 使用范围：资源链接菜单是否显示复制资源到系统剪贴板
 * 解耦评估：运行时环境判断属于平台层；转发层便于未来收敛到统一平台服务
 */
import { isElectron } from "../../../platform";
/** 导出 isElectron 供链接菜单判断桌面能力 */
export { isElectron };

/**
 * 用途：提供移动端运行判断（布尔值）
 * 使用范围：决定链接菜单使用 fullscreen 还是 popup 展示方式
 * 解耦评估：平台判断依赖稳定，通过转发层避免业务文件直接绑定上层目录
 */
import { isMobile } from "../../../platform";
/** 导出 isMobile 供链接菜单切换菜单展示策略 */
export { isMobile };

/**
 * 用途：执行 Electron 撤销兼容处理
 * 使用范围：链接编辑输入框按键事件中处理平台撤销行为
 * 解耦评估：平台兼容逻辑应集中维护；通过转发层减少业务散落调用
 */
import { electronUndo } from "../../../protyle/undo";
/** 导出 electronUndo 供链接输入框按键处理 */
export { electronUndo };

/**
 * 用途：写入文本到系统剪贴板
 * 使用范围：复制链接地址和复制输入框内容
 * 解耦评估：兼容层已封装浏览器差异，通过转发层可在未来平滑替换实现
 */
import { writeText } from "../../../protyle/util/compatibility";
/** 导出 writeText 供链接菜单复制文本 */
export { writeText };

/**
 * 用途：把光标定位到插入的 <wbr> 节点附近
 * 使用范围：删除链接后恢复编辑器可继续输入的光标位置
 * 解耦评估：编辑器选择逻辑属于基础工具，短期保持直接调用；通过转发层统一入口
 */
import { focusByWbr } from "../../../protyle/util/selection";
/** 导出 focusByWbr 供删除链接后恢复光标 */
export { focusByWbr };

/**
 * 用途：读取全局菜单实例
 * 使用范围：链接菜单构建、弹出、移除和关闭回调设置
 * 解耦评估：菜单实例目前由环境模块托管，已具备封装边界；转发层进一步收敛依赖
 */
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenusMenu 供链接菜单访问菜单实例 */
export { getSiyuanGlobalMenusMenu };

/**
 * 用途：读取系统配置（含 OS 信息）
 * 使用范围：判断是否在 windows/darwin 展示复制资源菜单
 * 解耦评估：配置访问已在环境层抽象，当前转发满足解耦要求
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig 供链接菜单读取系统配置 */
export { getSiyuanConfig };

/**
 * 用途：获取国际化文案
 * 使用范围：构建链接菜单各项 label 文本
 * 解耦评估：i18n 通过环境层封装，已与具体实现解耦；转发层用于稳定依赖入口
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供链接菜单读取文案 */
export { siyuanI18n };

/**
 * 用途：运行时移动端检测函数
 * 使用范围：链接编辑区域 HTML 宽度按端类型调整
 * 解耦评估：函数式检测可替换性强，当前通过转发层隔离实现细节
 */
import * as platformFunctions from "../../../util/platform/functions";
const isMobileDevice = platformFunctions.isMobile;
/** 导出 isMobileDevice 供链接编辑区域计算宽度 */
export { isMobileDevice };

// 菜单业务能力导入
/**
 * 用途：重命名资源文件
 * 使用范围：assets 链接的重命名菜单项
 * 解耦评估：重命名逻辑已独立在 editor 模块，转发层仅做依赖收口
 */
import {renameAsset} from "../../../asset/rename/renameAsset";
/** 导出 renameAsset 供资源重命名菜单使用 */
export { renameAsset };

/**
 * 用途：移除行内 a 类型标记
 * 使用范围：链接菜单“转换为文本”操作
 * 解耦评估：编辑器工具函数职责清晰，当前无需额外抽象；通过转发层减少路径耦合
 */
import { removeInlineType } from "../../../protyle/toolbar/util";
/** 导出 removeInlineType 供链接转换为文本 */
export { removeInlineType };

/**
 * 用途：显示轻提示消息
 * 使用范围：复制输入框文本后提示“已复制”
 * 解耦评估：消息提示属于 UI 基础能力，已模块化；转发层便于替换消息实现
 */
import { showMessage } from "../../../dialog/message";
/** 导出 showMessage 供链接菜单提示复制结果 */
export { showMessage };

/**
 * 用途：生成“打开方式”子菜单
 * 使用范围：链接菜单中对链接地址追加打开行为
 * 解耦评估：菜单组合逻辑由公共模块维护，通过转发层降低业务层直接耦合
 */
import { openMenu } from "../../commonMenuItem/openMenu";
/** 导出 openMenu 供链接菜单追加打开选项 */
export { openMenu };

/**
 * 用途：菜单项构造器
 * 使用范围：链接菜单所有 item 的实例化
 * 解耦评估：菜单组件本身是稳定基础设施，当前通过转发层统一接入
 */
import { MenuItem } from "../../Menu.Item";
/** 导出 MenuItem 供链接菜单创建菜单项 */
export { MenuItem };

/**
 * 用途：导出 assets 资源到本地
 * 使用范围：资源链接菜单中的“导出”动作
 * 解耦评估：业务动作已在上层 util 模块封装，转发层避免业务文件直接跨层引用
 */
import { exportAsset } from "../../util";
/** 导出 exportAsset 供资源链接导出操作 */
export { exportAsset };

/**
 * 用途：复制 assets 资源到系统剪贴板
 * 使用范围：桌面端资源链接菜单中的“复制资源”动作
 * 解耦评估：平台相关动作已封装在 util 模块，转发层仅收敛依赖边界
 */
import { copyAsset } from "../../util";
/** 导出 copyAsset 供资源链接复制操作 */
export { copyAsset };

// 类型导入
/**
 * 用途：链接菜单上下文类型
 * 使用范围：linkMenu 主流程、item 构建和工具函数参数类型约束
 * 解耦评估：类型定义集中在父目录便于复用；通过本地转发避免业务文件直接上跳目录
 */
import type { LinkMenuContext } from "../protyle.types";
/** 导出 LinkMenuContext 供 linkMenu 子模块统一引用 */
export type { LinkMenuContext };
