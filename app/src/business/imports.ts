// 跨目录依赖转发

/**
 * 用途：HTTP POST 请求工具
 * 使用范围：openRecentDocs 模块调用后端 API 获取最近文档数据
 * 解耦评估：网络请求是基础设施能力，通过 imports.ts 转发避免业务代码直接依赖跨目录路径
 */
import { fetchPost } from "../util/network/fetch";
/** 导出 [`fetchPost`](app/src/business/imports.ts:9) 供 business 目录复用。 */
export { fetchPost };

/**
 * 用途：Dialog 对话框组件
 * 使用范围：openRecentDocs 模块创建最近文档对话框
 * 解耦评估：对话框是 UI 基础组件，通过 imports.ts 转发可降低与 dialog 模块的路径耦合
 */
import { Dialog } from "../dialog";
/** 导出 [`Dialog`](app/src/business/imports.ts:17) 供 business 目录复用。 */
export { Dialog };

/**
 * 用途：应用常量定义
 * 使用范围：openRecentDocs 模块使用 DIALOG_RECENTDOCS、LOCAL_RECENT_DOCS 等常量
 * 解耦评估：常量是跨模块契约，通过 imports.ts 转发避免直接依赖 constants 路径
 */
import { Constants } from "../constants";
/** 导出 [`Constants`](app/src/business/imports.ts:25) 供 business 目录复用。 */
export { Constants };

/**
 * 用途：通过 Range 恢复编辑器焦点
 * 使用范围：openRecentDocs 模块在对话框关闭后恢复光标位置
 * 解耦评估：编辑器焦点工具属于 protyle 模块能力，通过 imports.ts 转发避免业务代码跨层依赖
 */
import { focusByRange } from "../protyle/util/selection";
/** 导出 [`focusByRange`](app/src/business/imports.ts:33) 供 business 目录复用。 */
export { focusByRange };

/**
 * 用途：隐藏指定类型的 UI 元素
 * 使用范围：openRecentDocs 模块关闭已打开的对话框
 * 解耦评估：UI 清理工具属于 protyle 模块能力，通过 imports.ts 转发避免业务代码跨层依赖
 */
import { hideElements } from "../protyle/ui/hideElements";
/** 导出 [`hideElements`](app/src/business/imports.ts:41) 供 business 目录复用。 */
export { hideElements };

/**
 * 用途：本地存储值写入工具
 * 使用范围：openRecentDocs 模块保存排序方式配置
 * 解耦评估：存储工具属于 protyle 兼容性层能力，通过 imports.ts 转发避免业务代码跨层依赖
 */
import { setStorageVal } from "../protyle/util/compatibility";
/** 导出 [`setStorageVal`](app/src/business/imports.ts:49) 供 business 目录复用。 */
export { setStorageVal };

/**
 * 用途：Vue 组件在对话框中挂载的工具函数
 * 使用范围：openRecentDocs 模块创建 Vue 驱动的对话框内容
 * 解耦评估：Vue 挂载工具属于 util/vue 模块能力，通过 imports.ts 转发避免业务代码跨层依赖
 */
import { createVueComponentInDialog } from "../util/vue/mount";
/** 导出 [`createVueComponentInDialog`](app/src/business/imports.ts:57) 供 business 目录复用。 */
export { createVueComponentInDialog };

/**
 * 用途：Vue 组件挂载配置类型
 * 使用范围：openRecentDocs 模块配置 Vue 组件数据
 * 解耦评估：类型定义通过 imports.ts 转发，避免业务代码直接依赖 util/vue 路径
 */
import type { VueComponentMountConfig } from "../util/vue/mount";
/** 导出 [`VueComponentMountConfig`](app/src/business/imports.ts:65) 供 business 目录复用。 */
export type { VueComponentMountConfig };

/**
 * 用途：最近文档 Vue 组件
 * 使用范围：openRecentDocs 模块渲染最近文档列表界面
 * 解耦评估：Vue 组件依赖通过 imports.ts 转发，可替换为其他组件实现
 */
import RecentDocs from "../components/recentDocsAndDocks.vue";
/** 导出 [`RecentDocs`](app/src/business/imports.ts:73) 供 business 目录复用。 */
export { RecentDocs };

/**
 * 用途：国际化文案
 * 使用范围：openRecentDocs 模块获取对话框标题等文案
 * 解耦评估：i18n 是环境层能力，通过 imports.ts 转发避免业务代码直接依赖 siyuanEnvironments 路径
 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 [`siyuanI18n`](app/src/business/imports.ts:81) 供 business 目录复用。 */
export { siyuanI18n };

/**
 * 用途：获取全局对话框集合
 * 使用范围：openRecentDocs 模块查找和管理最近文档对话框实例
 * 解耦评估：对话框管理是环境层能力，通过 imports.ts 转发避免业务代码直接依赖 siyuanEnvironments 路径
 */
import { getSiyuanDialogs } from "../util/siyuanEnvironments/getDialog.environment";
/** 导出 [`getSiyuanDialogs`](app/src/business/imports.ts:89) 供 business 目录复用。 */
export { getSiyuanDialogs };

/**
 * 用途：获取 SiYuan 全局存储
 * 使用范围：openRecentDocs 模块读取最近文档排序配置
 * 解耦评估：存储访问是环境层能力，通过 imports.ts 转发避免业务代码直接依赖 siyuanEnvironments 路径
 */
import { getSiyuanStorage } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 [`getSiyuanStorage`](app/src/business/imports.ts:97) 供 business 目录复用。 */
export { getSiyuanStorage };
