/**
 * 用途：集中转发 `keydown` 目录内键盘处理模块需要使用的共享依赖，避免业务处理文件直接通过父级相对路径导入。
 * 使用范围：供 [`dialogArrow.ts`](app/src/boot/globalEvent/keydown/dialogArrow.ts)、[`windowKeyDown.ts`](app/src/boot/globalEvent/keydown/windowKeyDown.ts) 以及同目录后续键盘事件模块复用。
 * 解耦评估：该目录的模块本质上承担全局键盘分发与 UI 协调职责，短期内仍需直接访问应用类型、网络请求、dock 操作与 DOM 工具；先通过网关文件收敛路径耦合，后续若演进为更细粒度 service 或事件注入，只需调整本文件而不必批量修改业务入口。
 */

/**
 * 用途：提供应用实例类型定义。
 * 使用范围：供 `keydown` 目录内需要标注应用上下文的函数参数使用。
 * 解耦评估：纯类型依赖，不引入运行时耦合；通过网关转发可以避免业务文件直接依赖跨层路径。
 */
import type { AppFacade } from "../../../app/AppFacade.types";
/** 导出 [`AppFacade`](app/src/boot/globalEvent/keydown/imports.ts:15) 供 `keydown` 目录类型标注复用。 */
export type { AppFacade };

/**
 * 用途：提供异步 POST 请求能力。
 * 使用范围：供键盘导航流程按焦点项查询完整文档路径等场景使用。
 * 解耦评估：网络请求属于基础设施能力，理论上可通过 service 注入进一步抽象，但当前目录是事件入口层，保留经由网关转发的直接依赖能在不扩大参数面的前提下维持清晰边界。
 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 [`fetchPost`](app/src/boot/globalEvent/keydown/imports.ts:25) 供 `keydown` 目录请求流程复用。 */
export { fetchPost };

/**
 * 用途：提供卡片抽认复习入口。
 * 使用范围：供切换对话框与其他键盘快捷场景触发 `riffCard` 业务动作时使用。
 * 解耦评估：该能力属于明确的业务入口，理论上可经命令总线进一步解耦，但当前项目仍以直接函数调用组织快捷操作；通过网关至少可以避免业务文件散落跨层导入。
 */
import { openCard } from "../../../card/openCard";
/** 导出 [`openCard`](app/src/boot/globalEvent/keydown/imports.ts:35) 供 `keydown` 目录业务动作复用。 */
export { openCard };

/**
 * 用途：提供共享常量定义。
 * 使用范围：供键盘处理流程读取回调动作常量、对话框键值等跨模块契约。
 * 解耦评估：共享常量不应重新硬编码；通过网关转发可以减少路径耦合，同时保持契约仍由统一常量源维护。
 */
import { Constants } from "../../../constants";
/** 导出 [`Constants`](app/src/boot/globalEvent/keydown/imports.ts:45) 供 `keydown` 目录常量读取复用。 */
export { Constants };

/**
 * 用途：提供按节点 ID 打开文档的统一入口。
 * 使用范围：供键盘确认当前焦点文档项时执行打开与聚焦动作。
 * 解耦评估：文档打开行为可在未来通过命令分发进一步抽象，但当前该工具已是稳定的编辑器入口；经网关转发已能有效减少事件层与编辑器层的路径耦合。
 */
import { openFileById } from "../../../editor/utils.openFileById";
/** 导出 [`openFileById`](app/src/boot/globalEvent/keydown/imports.ts:55) 供 `keydown` 目录文档打开流程复用。 */
export { openFileById };

/**
 * 用途：提供按类型读取 dock 实例的能力。
 * 使用范围：供键盘确认 dock 类列表项时切换对应面板显示状态。
 * 解耦评估：dock 查找能力属于布局系统稳定边界，理论上可进一步抽象为命令接口，但当前事件层直接读取现有 API 的成本和风险最低；通过网关至少实现了目录级路径收口。
 */
import { getDockByType } from "../../../layout/tabUtil";
/** 导出 [`getDockByType`](app/src/boot/globalEvent/keydown/imports.ts:65) 供 `keydown` 目录布局切换流程复用。 */
export { getDockByType };

/**
 * 用途：提供当前全部页签模型列表。
 * 使用范围：供切换对话框点击确认时按 `data-id` 查找目标页签并切换。
 * 解耦评估：页签枚举能力属于布局系统稳定边界，理论上可继续上收为命令接口，但当前事件层直接读取既有 API 的成本最低；通过网关转发已经把跨层路径耦合压缩到单点。
 */
import { getAllTabs } from "../../../layout/getAll";
/** 导出 [`getAllTabs`](app/src/boot/globalEvent/keydown/imports.ts:75) 供 `keydown` 目录页签切换流程复用。 */
export { getAllTabs };

/**
 * 用途：提供隐藏指定 UI 浮层的工具。
 * 使用范围：供键盘确认当前项后关闭切换对话框等临时 UI。
 * 解耦评估：UI 清理逻辑目前由统一工具函数承载，未来可演进为更显式的对话框控制器；在现阶段通过网关转发已经足以降低路径耦合并保持调用一致。
 */
import { hideElements } from "../../../protyle/ui/hideElements";
/** 导出 [`hideElements`](app/src/boot/globalEvent/keydown/imports.ts:75) 供 `keydown` 目录浮层清理流程复用。 */
export { hideElements };

/**
 * 用途：提供 HTML 转义工具，避免将后端返回路径直接写入 DOM 时产生注入风险。
 * 使用范围：供键盘导航预览区渲染文档完整路径文本时使用。
 * 解耦评估：安全转义属于基础工具能力，不应在业务层重复实现；通过网关转发既保持安全能力集中，也降低目录间路径耦合。
 */
import { escapeHtml } from "../../../util/DOM/escape";
/** 导出 [`escapeHtml`](app/src/boot/globalEvent/keydown/imports.ts:85) 供 `keydown` 目录预览渲染流程复用。 */
export { escapeHtml };
