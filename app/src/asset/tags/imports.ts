// 第三方依赖转发
/** 用途：zod 验证库，用于定义标签数据 schema。使用范围：tags 模块统一访问类型验证能力。解耦评估：通过 imports.ts 转发，可替换为其他验证库。 */
import { z } from "zod";
/** 导出 zod 的 z 对象，供 tags 模块使用 */
export { z };

// 数据层转发
/** 用途：Workspace 类，提供文件系统操作能力（读取/写入/检查存在）。使用范围：tags 模块加载和持久化标签数据。解耦评估：通过 imports.ts 转发，与具体数据源解耦。 */
import { Workspace } from "../../data/kernelAPI/defaultWorkspace";
/** 导出 Workspace 类，供 tags 模块使用 */
export { Workspace };

/** 用途：内核 SDK 客户端实例。使用范围：tags 模块创建 Workspace 实例。解耦评估：通过 imports.ts 转发。 */
import { kernelClient } from "../../data/kernelSDK";
/** 导出 kernelClient 实例，供 tags 模块使用 */
export { kernelClient };
