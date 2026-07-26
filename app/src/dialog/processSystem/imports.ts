/**
 * 用途：集中转发 `processSystem` 目录对上层模块的依赖，避免业务文件直接使用父级路径导入。
 * 使用范围：`app/src/dialog/processSystem` 目录下的流程处理模块，如锁屏、下载进度、标题更新等系统对话流程。
 * 解耦评估：该目录本身承担系统流程编排职责，短期内仍需依赖网络、布局、平台与环境能力；通过本转发层可先收敛路径耦合，后续若改为依赖注入或事件驱动，只需调整此文件而不必批量修改业务文件。
 */

/**
 * 用途：发送 POST 请求到后端系统接口。
 * 使用范围：`processSystem` 目录中的系统动作触发流程，例如锁屏后的注销鉴权请求。
 * 解耦评估：网络请求属于基础设施能力，理论上可通过依赖注入传入，但当前该目录函数均为框架触发的轻量流程函数，直接经由转发层暴露更符合现有架构边界。
 */
import {fetchPost} from "../../util/network/fetch";
/** 导出 `fetchPost` 供 `processSystem` 目录复用。 */
export { fetchPost };

/**
 * 用途：导出当前布局并在完成后执行回调。
 * 使用范围：锁屏、退出等需要在界面状态持久化后继续执行系统动作的流程。
 * 解耦评估：布局导出属于布局子系统核心能力，业务层暂时无法脱离该实现；通过本文件转发后，调用方仅依赖稳定网关而非具体实现路径。
 */
import {exportLayout} from "../../layout/export/exportLayout";
/** 导出 `exportLayout` 供 `processSystem` 目录复用。 */
export { exportLayout };

/**
 * 用途：提供应用实例 `AppFacade` 类型定义。
 * 使用范围：`processSystem` 目录内对插件列表等应用级能力进行类型标注的函数参数。
 * 解耦评估：类型导入不形成运行时耦合，保留统一转发可降低业务文件路径噪音。
 */
import type {AppFacade} from "../../app/AppFacade.types";
/** 导出类型 `AppFacade` 供 `processSystem` 目录复用。 */
export type { AppFacade };

/**
 * 用途：判断当前是否为移动端环境。
 * 使用范围：系统流程中区分移动端与桌面端的锁屏、退出、布局保存分支。
 * 解耦评估：平台判断理论上可由调用者预先传入，但这些流程函数本身即以运行环境为分支条件，继续通过转发层集中依赖更清晰。
 */
import {isMobile} from "../../util/platform/functions";
/** 导出 `isMobile` 供 `processSystem` 目录复用。 */
export { isMobile };

/**
 * 用途：读取移动端当前主编辑器。
 * 使用范围：锁屏、退出前保存滚动位置等需要访问移动端编辑器实例的流程。
 * 解耦评估：这是环境层已封装的全局访问能力；业务层应避免直接接触 `window`，因此继续通过本转发层暴露是合理边界。
 */
import { getMobileEditor } from "../../plugin/API.environment";
/** 导出 `getMobileEditor` 供 `processSystem` 目录复用。 */
export { getMobileEditor };

/**
 * 用途：保存编辑器滚动位置。
 * 使用范围：移动端锁屏或退出前持久化当前阅读/编辑上下文。
 * 解耦评估：滚动位置保存与 `protyle` 编辑器实现强相关，不适合由业务层重新拼装；通过转发层保持依赖集中更合适。
 */
import { saveScroll } from "../../protyle/scroll/saveScroll";
/** 导出 `saveScroll` 供 `processSystem` 目录复用。 */
export { saveScroll };

/**
 * 用途：安全读取当前思源配置。
 * 使用范围：系统流程中读取只读状态等可能尚未完全初始化的配置项。
 * 解耦评估：配置读取已在 environment 层封装，业务层继续通过转发层引用可避免直接依赖全局对象。
 */
import { getSafeSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 `getSafeSiyuanConfig` 供 `processSystem` 目录复用。 */
export { getSafeSiyuanConfig };

/**
 * 用途：读取当前是否为发布模式。
 * 使用范围：锁屏等只在完整应用模式下可执行的系统动作前置校验。
 * 解耦评估：发布模式是全局运行时状态，理论上可由更高层传入，但当前调用链并未提供该上下文；通过 environment + 转发层访问是现阶段最小耦合实现。
 */
import { getSiyuanIsPublish } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 `getSiyuanIsPublish` 供 `processSystem` 目录复用。 */
export { getSiyuanIsPublish };

/**
 * 用途：获取所有已打开的编辑器实例列表。
 * 使用范围：`processSystem` 目录中需要遍历所有编辑器实例以更新界面状态的流程，如动态链接锚文本更新。
 * 解耦评估：编辑器实例访问是通过 `layout/getAll` 提供的全局工具函数，目前尚未抽象为编辑器服务注入；通过本转发层收敛后再逐步推动服务化改造。
 */
import {getAllEditor} from "../../layout/getAll";
/** 导出 `getAllEditor` 供 `processSystem` 目录复用。 */
export { getAllEditor };
