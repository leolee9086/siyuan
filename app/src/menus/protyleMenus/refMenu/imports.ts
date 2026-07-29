/**
 * 用途：集中管理 refMenu 子目录的外部依赖。
 * 使用范围：refMenu、fileAnnotationRefMenu、tagMenu 三个菜单文件统一从此导入。
 * 解耦评估：通过本地转发层隔离跨目录路径耦合，后续替换实现时可减少业务文件改动面。
 */

/**
 * 用途：生成更新时间字符串。
 * 使用范围：引用/标签菜单在编辑后写入 updated 字段。
 * 解耦评估：第三方库依赖稳定，通过转发层避免业务文件直接依赖包路径。
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 refMenu 子模块复用 */
export { dayjs };

/**
 * 用途：执行后端接口请求。
 * 使用范围：引用文本回填、交换块、文档加载等流程。
 * 解耦评估：网络请求统一入口，业务文件无需关心底层实现。
 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 fetchPost 供 refMenu 子模块复用 */
export { fetchPost };

/**
 * 用途：聚焦指定 Range。
 * 使用范围：菜单关闭后恢复光标、复制剪切前聚焦。
 * 解耦评估：选区能力集中在工具层，转发层可降低业务耦合。
 */
import {focusByRange} from "../../../protyle/util/selection";
/** 导出 focusByRange 供 refMenu 子模块复用 */
export { focusByRange };

/**
 * 用途：触发块渲染。
 * 使用范围：引用转换为块嵌入后重新渲染文档。
 * 解耦评估：渲染入口统一，业务侧只表达“需要重渲染”的意图。
 */
import {blockRender} from "../../../protyle/render/blockRender";
/** 导出 blockRender 供 refMenu 子模块复用 */
export { blockRender };

/**
 * 用途：读取流程常量。
 * 使用范围：菜单 data-name、动作码与零宽字符处理。
 * 解耦评估：常量集中维护，避免魔法值散落。
 */
import { Constants } from "../../../constants";
/** 导出 Constants 供 refMenu 子模块复用 */
export { Constants };

/**
 * 用途：打开文档。
 * 使用范围：引用菜单中的“打开/新标签/分屏打开”动作。
 * 解耦评估：文档打开能力由编辑器模块封装，业务层仅调用接口。
 */
import { openFileById } from "../../../editor/utils.openFileById";
/** 导出 openFileById 供 refMenu 子模块复用 */
export { openFileById };

/**
 * 用途：打开反链面板。
 * 使用范围：引用菜单“反向链接”动作。
 * 解耦评估：停靠面板能力独立，转发层减少路径依赖。
 */
import { openBacklink } from "../../../layout/dock/util";
/** 导出 openBacklink 供 refMenu 子模块复用 */
export { openBacklink };

/**
 * 用途：打开关系图面板。
 * 使用范围：引用菜单“关系图”动作。
 * 解耦评估：图面板能力独立，转发层减少路径依赖。
 */
import { openGraph } from "../../../layout/dock/util";
/** 导出 openGraph 供 refMenu 子模块复用 */
export { openGraph };

/**
 * 用途：触发插件菜单扩展事件。
 * 使用范围：三类菜单在末尾挂载插件菜单项。
 * 解耦评估：事件总线能力稳定，业务层只负责触发语义事件。
 */
import { emitOpenMenu } from "../../../plugin/menu/emitOpenMenu.factory";
/** 导出 emitOpenMenu 供 refMenu 子模块复用 */
export { emitOpenMenu };

/**
 * 用途：移除行内标记类型。
 * 使用范围：引用/文件注释引用转换为文本。
 * 解耦评估：行内标记操作已封装，业务无需重复实现 DOM 细节。
 */
import { removeInlineType } from "../../../protyle/toolbar/util";
/** 导出 removeInlineType 供 refMenu 子模块复用 */
export { removeInlineType };

/**
 * 用途：隐藏干扰 UI 元素。
 * 使用范围：菜单打开前隐藏 util/toolbar/hint。
 * 解耦评估：UI 协作逻辑集中，业务层调用语义化接口即可。
 */
import { hideElements } from "../../../protyle/ui/hideElements";
/** 导出 hideElements 供 refMenu 子模块复用 */
export { hideElements };

/**
 * 用途：处理 Electron 撤销快捷键。
 * 使用范围：输入框 keydown 监听中处理平台差异。
 * 解耦评估：平台差异逻辑集中在 undo 工具中，业务层避免重复判断。
 */
import { electronUndo } from "../../../protyle/undo/keyboard/electronUndo";
/** 导出 electronUndo 供 refMenu 子模块复用 */
export { electronUndo };

/**
 * 用途：展示快捷键文案。
 * 使用范围：引用菜单 accelerator 文案拼接。
 * 解耦评估：快捷键展示逻辑集中，可替换规则而不改业务流程。
 */
import { updateHotkeyTip } from "../../../protyle/util/compatibility";
/** 导出 updateHotkeyTip 供 refMenu 子模块复用 */
export { updateHotkeyTip };

/**
 * 用途：写入系统剪贴板文本。
 * 使用范围：引用/标签菜单 copy/cut 等动作。
 * 解耦评估：剪贴板实现封装在兼容层，业务层不直接操作平台 API。
 */
import { writeText } from "../../../protyle/util/compatibility";
/** 导出 writeText 供 refMenu 子模块复用 */
export { writeText };

/**
 * 用途：查找当前元素所在块。
 * 使用范围：三类菜单定位 data-node-id 与 outerHTML。
 * 解耦评估：DOM 工具复用，减少业务重复代码。
 */
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestBlock 供 refMenu 子模块复用 */
export { hasClosestBlock };

/**
 * 用途：查找顶层 class 祖先。
 * 使用范围：判断菜单来源是否来自 popover。
 * 解耦评估：DOM 工具复用，路径耦合收敛在转发层。
 */
import { hasTopClosestByClassName } from "../../../protyle/util/hasClosest";
/** 导出 hasTopClosestByClassName 供 refMenu 子模块复用 */
export { hasTopClosestByClassName };

/**
 * 用途：按 wbr 恢复光标。
 * 使用范围：删除引用/标签后恢复编辑位置。
 * 解耦评估：选区工具层已封装，业务层避免直接操作 Range 细节。
 */
import { focusByWbr } from "../../../protyle/util/selection";
/** 导出 focusByWbr 供 refMenu 子模块复用 */
export { focusByWbr };

/**
 * 用途：提交文档事务。
 * 使用范围：引用和标签变更后的持久化更新。
 * 解耦评估：事务能力稳定，业务层只传输入输出 HTML。
 */
import {updateTransaction} from "../../../protyle/wysiwyg/transaction/update";
/** 导出 updateTransaction 供 refMenu 子模块复用 */
export { updateTransaction };

/**
 * 用途：检查并展开折叠上下文。
 * 使用范围：引用菜单打开文档前计算 zoomIn/action。
 * 解耦评估：平台兼容逻辑集中，业务只处理回调结果。
 */
import {checkFold} from "../../../block/fold/checkFold";
/** 导出 checkFold 供 refMenu 子模块复用 */
export { checkFold };

/**
 * 用途：在新窗口打开文档。
 * 使用范围：Electron 环境下引用菜单“新窗口打开”动作。
 * 解耦评估：窗口能力封装独立，便于后续平台差异调整。
 */
import { openNewWindowById } from "../../../window/openNewWindow";
/** 导出 openNewWindowById 供 refMenu 子模块复用 */
export { openNewWindowById };

/**
 * 用途：判断当前是否移动端。
 * 使用范围：菜单展示策略（fullscreen/popup）和行为分支。
 * 解耦评估：平台判断集中在平台层，业务层仅消费结果。
 */
import { isMobile } from "../../../platform";
/** 导出 isMobile 供 refMenu 子模块复用 */
export { isMobile };

/**
 * 用途：判断当前是否 Electron。
 * 使用范围：引用菜单是否展示“新窗口打开”。
 * 解耦评估：平台判断集中在平台层，业务层仅消费结果。
 */
import { isElectron } from "../../../platform";
/** 导出 isElectron 供 refMenu 子模块复用 */
export { isElectron };

/**
 * 用途：读取全局菜单容器。
 * 使用范围：引用与文件注释引用菜单的 append/popup/fullscreen/remove。
 * 解耦评估：菜单单例由环境层管理，业务层避免直接依赖全局对象。
 */
import { getSiyuanGlobalMenus } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenus 供 refMenu 子模块复用 */
export { getSiyuanGlobalMenus };

/**
 * 用途：读取全局菜单实例 menu。
 * 使用范围：标签菜单的 append/popup/fullscreen/remove。
 * 解耦评估：菜单实例由环境层管理，业务层只做菜单编排。
 */
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenusMenu 供 refMenu 子模块复用 */
export { getSiyuanGlobalMenusMenu };

/**
 * 用途：读取国际化文案。
 * 使用范围：三类菜单 label/placeholder/提示文案。
 * 解耦评估：i18n 统一来源，便于多语言扩展和切换。
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 refMenu 子模块复用 */
export { siyuanI18n };

/**
 * 用途：读取系统配置。
 * 使用范围：引用菜单快捷键文案和行为配置。
 * 解耦评估：配置读取集中在环境层，业务层不直接访问全局 config。
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig 供 refMenu 子模块复用 */
export { getSiyuanConfig };

/**
 * 用途：判断输入事件是否处于输入法组合态。
 * 使用范围：文件注释引用菜单输入监听。
 * 解耦评估：事件守卫逻辑集中复用，业务层避免重复实现。
 */
import { isComposing } from "../../../util/lib/events/event.guard";
/** 导出 isComposing 供 refMenu 子模块复用 */
export { isComposing };

/**
 * 用途：确保 protyle.range 可用。
 * 使用范围：文件注释引用菜单删除和恢复光标流程。
 * 解耦评估：校验逻辑集中，业务层直接使用安全返回值。
 */
import { requireRange } from "../../../protyle/util/protyleCheckers";
/** 导出 requireRange 供 refMenu 子模块复用 */
export { requireRange };

/**
 * 用途：校验字符串是否是合法 LuteNodeID。
 * 使用范围：文件注释引用菜单的节点 ID 校验。
 * 解耦评估：ID 校验逻辑集中，业务层不重复正则与异常处理。
 */
import { asLuteNodeID } from "../../../util/file/id";
/** 导出 asLuteNodeID 供 refMenu 子模块复用 */
export { asLuteNodeID };

/**
 * 用途：文件注释引用菜单需要的节点 ID 类型。
 * 使用范围：remove 回调清理函数参数约束。
 * 解耦评估：类型独立于业务实现，通过转发减少跨目录类型耦合。
 */
import type { LuteNodeID } from "../../../util/file/id";
/** 导出类型 LuteNodeID 供 refMenu 子模块复用 */
export type { LuteNodeID };

/**
 * 用途：菜单项构造器。
 * 使用范围：三类菜单统一构建各项动作。
 * 解耦评估：菜单项基础组件集中维护，业务层专注配置数据。
 */
import { MenuItem } from "../../Menu.Item";
/** 导出 MenuItem 供 refMenu 子模块复用 */
export { MenuItem };

/**
 * 用途：菜单容器类型。
 * 使用范围：文件注释引用菜单函数签名。
 * 解耦评估：类型定义复用，业务文件无需重复声明接口结构。
 */
import { Menu } from "../../Menu";
/** 导出 Menu 供 refMenu 子模块复用 */
export { Menu };

/**
 * 用途：打开移动端搜索面板。
 * 使用范围：标签菜单“搜索”在移动端的分支。
 * 解耦评估：移动端搜索实现独立，业务层只传入查询参数。
 */
import { popSearch } from "../../../mobile/menu/search";
/** 导出 popSearch 供 refMenu 子模块复用 */
export { popSearch };

/**
 * 用途：重命名标签。
 * 使用范围：标签菜单“重命名”动作。
 * 解耦评估：重命名逻辑集中封装，业务层仅传标签文本。
 */
import { renameTag } from "../../../menus/tag.actions";
/** 导出 renameTag 供 refMenu 子模块复用 */
export { renameTag };

/**
 * 用途：生成标签联想列表。
 * 使用范围：标签菜单输入框中输入时显示匹配标签。
 * 解耦评估：标签列表逻辑独立封装，业务层只负责展示与交互。
 */
import { genTagList } from "../../../menus/tag.actions";
/** 导出 genTagList 供 refMenu 子模块复用 */
export { genTagList };

/**
 * 用途：定位浮动元素。
 * 使用范围：标签联想列表在输入框旁定位。
 * 解耦评估：定位逻辑已封装为通用工具，业务层只传坐标参数。
 */
import { setPosition } from "../../../util/DOM/positioning/setPosition";
/** 导出 setPosition 供 refMenu 子模块复用 */
export { setPosition };

/**
 * 用途：键盘上下键导航列表项。
 * 使用范围：标签联想列表键盘导航。
 * 解耦评估：导航逻辑独立封装，业务层只传入列表容器和事件。
 */
import { upDownHint } from "../../../util/DOM/upDownHint";
/** 导出 upDownHint 供 refMenu 子模块复用 */
export { upDownHint };
