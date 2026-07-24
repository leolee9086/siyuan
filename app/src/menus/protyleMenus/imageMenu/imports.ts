/**
 * 用途：集中管理 imageMenu 子目录的外部依赖。
 * 使用范围：imageMenu 下各菜单构建与事件绑定文件统一从此导入。
 * 解耦评估：通过本地转发层隔离跨目录路径耦合，便于后续替换实现或迁移目录结构。
 */

/**
 * 用途：生成更新时间字符串。
 * 使用范围：图片属性修改、删除、尺寸调整后的事务时间戳写入。
 * 解耦评估：第三方库依赖稳定，通过转发层可避免业务文件直接耦合包路径。
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 imageMenu 子模块复用 */
export { dayjs };

/**
 * 用途：发送后端请求。
 * 使用范围：OCR 读取与更新、资源评分读写等动作。
 * 解耦评估：网络请求入口统一，业务层仅表达意图，不关心底层传输细节。
 */
import { fetchPost } from "../../../ai/imports";
/** 导出 fetchPost 供 imageMenu 子模块复用 */
export { fetchPost };

/**
 * 用途：流程常量集合。
 * 使用范围：图片菜单 data-name 标识等场景。
 * 解耦评估：常量集中维护，减少魔法值散落。
 */
import { Constants } from "../../../constants";
/** 导出 Constants 供 imageMenu 子模块复用 */
export { Constants };

/**
 * 用途：重命名资源文件。
 * 使用范围：图片菜单“重命名”动作。
 * 解耦评估：重命名能力独立封装，业务层仅传路径参数。
 */
import { renameAsset } from "../../../editor/rename";
/** 导出 renameAsset 供 imageMenu 子模块复用 */
export { renameAsset };

/**
 * 用途：展示轻量消息提示。
 * 使用范围：复制 URL/Title/Tooltip 成功提示。
 * 解耦评估：提示能力由对话层统一管理，业务层避免直接操作视图细节。
 */
import { showMessage } from "../../../dialog/message";
/** 导出 showMessage 供 imageMenu 子模块复用 */
export { showMessage };

/**
 * 用途：触发插件扩展菜单事件。
 * 使用范围：image menu 构建完成后的插件扩展入口。
 * 解耦评估：事件总线协议稳定，业务层通过事件语义解耦插件实现。
 */
import { emitOpenMenu } from "../../../plugin/menu/emitOpenMenu.factory";
/** 导出 emitOpenMenu 供 imageMenu 子模块复用 */
export { emitOpenMenu };

/**
 * 用途：公式渲染工具。
 * 使用范围：图片标题输入更新后刷新渲染结果。
 * 解耦评估：渲染逻辑封装在工具层，业务层只触发渲染动作。
 */
import { mathRender } from "../../../protyle/render/mathRender";
/** 导出 mathRender 供 imageMenu 子模块复用 */
export { mathRender };

/**
 * 用途：隐藏干扰 UI。
 * 使用范围：打开图片菜单前隐藏 util/toolbar/hint。
 * 解耦评估：UI 协作逻辑集中，菜单流程仅保留语义调用。
 */
import { hideElements } from "../../../protyle/ui/hideElements";
/** 导出 hideElements 供 imageMenu 子模块复用 */
export { hideElements };

/**
 * 用途：写入系统剪贴板文本。
 * 使用范围：复制图片 markdown、URL、title、tooltip、OCR 文本。
 * 解耦评估：兼容层封装平台差异，业务层无需直接访问系统 API。
 */
import { writeText } from "../../../protyle/util/compatibility";
/** 导出 writeText 供 imageMenu 子模块复用 */
export { writeText };

/**
 * 用途：聚焦块节点。
 * 使用范围：尺寸调整、菜单关闭后恢复编辑焦点。
 * 解耦评估：选区工具集中封装，业务层不直接处理 Range 细节。
 */
import { focusBlock } from "../../../protyle/util/selection";
/** 导出 focusBlock 供 imageMenu 子模块复用 */
export { focusBlock };

/**
 * 用途：按 wbr 恢复光标。
 * 使用范围：剪切/删除图片后恢复编辑位置。
 * 解耦评估：光标恢复逻辑复用，降低业务层实现复杂度。
 */
import { focusByWbr } from "../../../protyle/util/selection";
/** 导出 focusByWbr 供 imageMenu 子模块复用 */
export { focusByWbr };

/**
 * 用途：查找最近块节点。
 * 使用范围：图片菜单入口定位 data-node-id 与 outerHTML。
 * 解耦评估：DOM 查找逻辑复用，避免重复实现。
 */
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestBlock 供 imageMenu 子模块复用 */
export { hasClosestBlock };

/**
 * 用途：向上查找顶层 class 祖先。
 * 使用范围：设置菜单来源 data-from（app 或 popover）。
 * 解耦评估：DOM 工具层统一，业务层减少路径耦合。
 */
import { hasTopClosestByClassName } from "../../../protyle/util/hasClosest";
/** 导出 hasTopClosestByClassName 供 imageMenu 子模块复用 */
export { hasTopClosestByClassName };

/**
 * 用途：提交编辑事务。
 * 使用范围：图片属性和结构变更持久化。
 * 解耦评估：事务入口统一，业务层仅传入前后 HTML。
 */
import { updateTransaction } from "../../../protyle/wysiwyg/transaction";
/** 导出 updateTransaction 供 imageMenu 子模块复用 */
export { updateTransaction };

/**
 * 用途：图片居中对齐动作。
 * 使用范围：图片菜单“居中对齐”。
 * 解耦评估：热键/对齐逻辑封装在工具层，业务层仅调用动作。
 */
import { alignImgCenter } from "../../../protyle/wysiwyg/commonHotkey/commonHotkeyAlign";
/** 导出 alignImgCenter 供 imageMenu 子模块复用 */
export { alignImgCenter };

/**
 * 用途：图片左对齐动作。
 * 使用范围：图片菜单“左对齐”。
 * 解耦评估：热键/对齐逻辑封装在工具层，业务层仅调用动作。
 */
import { alignImgLeft } from "../../../protyle/wysiwyg/commonHotkey/commonHotkeyAlign";
/** 导出 alignImgLeft 供 imageMenu 子模块复用 */
export { alignImgLeft };

/**
 * 用途：判断是否 Electron 环境。
 * 使用范围：是否展示“复制资源文件到剪贴板”等桌面端能力。
 * 解耦评估：平台判断集中在平台层，业务层仅消费布尔结果。
 */
import { isElectron } from "../../../platform";
/** 导出 isElectron 供 imageMenu 子模块复用 */
export { isElectron };

/**
 * 用途：判断是否移动端。
 * 使用范围：菜单弹出策略（fullscreen/popup）与表单宽度。
 * 解耦评估：平台判断集中在平台层，业务层避免重复判断来源。
 */
import { isMobile } from "../../../platform";
/** 导出 isMobile 供 imageMenu 子模块复用 */
export { isMobile };

/**
 * 用途：将 base64 图片上传并转为可引用 URL。
 * 使用范围：图片设置面板将 data:image 源转换为资源路径。
 * 解耦评估：资源转换由工具层统一封装，业务层只处理输入输出。
 */
import { base64ToURL } from "../../../util/assets/image";
/** 导出 base64ToURL 供 imageMenu 子模块复用 */
export { base64ToURL };

/**
 * 用途：读取全局菜单实例 menu。
 * 使用范围：图片菜单 append/remove/popup/fullscreen/removeCB。
 * 解耦评估：菜单实例由环境层统一管理，业务层避免直接依赖全局对象结构。
 */
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenusMenu 供 imageMenu 子模块复用 */
export { getSiyuanGlobalMenusMenu };

/**
 * 用途：读取全局配置。
 * 使用范围：快捷键文案与系统平台信息判断。
 * 解耦评估：配置读取集中在环境层，业务层不直接访问 window 全局。
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig 供 imageMenu 子模块复用 */
export { getSiyuanConfig };

/**
 * 用途：读取国际化文案。
 * 使用范围：图片菜单各项 label、placeholder、提示词。
 * 解耦评估：i18n 来源统一，降低多语言扩展改动面。
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 imageMenu 子模块复用 */
export { siyuanI18n };

/**
 * 用途：图片尺寸兼容处理。
 * 使用范围：宽高调整后同步包装容器尺寸。
 * 解耦评估：兼容逻辑集中在基础层，业务层复用结果。
 */
import { img3115 } from "../../../boot/compatibleVersion";
/** 导出 img3115 供 imageMenu 子模块复用 */
export { img3115 };

/**
 * 用途：打开通用资源操作菜单。
 * 使用范围：图片 src 存在时展示 openMenu 子项。
 * 解耦评估：资源操作菜单能力独立封装，imageMenu 仅作为组合层。
 */
import { openMenu } from "../../commonMenuItem/openMenu";
/** 导出 openMenu 供 imageMenu 子模块复用 */
export { openMenu };

/**
 * 用途：生成“复制资源文件”菜单配置。
 * 使用范围：assets 资源在桌面端的复制文件动作。
 * 解耦评估：资源动作配置在 util 集中维护，业务层避免重复拼装。
 */
import { copyAsset } from "../../util";
/** 导出 copyAsset 供 imageMenu 子模块复用 */
export { copyAsset };

/**
 * 用途：按链接复制 PNG。
 * 使用范围：图片菜单“复制为 PNG”动作。
 * 解耦评估：格式转换和剪贴板流程封装在 util，业务层仅传链接。
 */
import { copyPNGByLink } from "../../util";
/** 导出 copyPNGByLink 供 imageMenu 子模块复用 */
export { copyPNGByLink };

/**
 * 用途：生成“导出资源”菜单配置。
 * 使用范围：assets 资源导出动作。
 * 解耦评估：导出配置复用 util 实现，业务层不重复定义。
 */
import { exportAsset } from "../../util";
/** 导出 exportAsset 供 imageMenu 子模块复用 */
export { exportAsset };

/**
 * 用途：菜单项构造器。
 * 使用范围：imageMenu 下所有菜单项创建。
 * 解耦评估：组件构造能力统一来源，业务层专注配置数据。
 */
import { MenuItem } from "../../Menu.Item";
/** 导出 MenuItem 供 imageMenu 子模块复用 */
export { MenuItem };

/** 用途：构建 s-forge 原生图片取色菜单项；使用范围：图片菜单主体流程。 */
import { createImageColorMenuItem } from "../../../sforge/colors/menu";
/** 导出原生图片取色菜单项构造器。 */
export { createImageColorMenuItem };
