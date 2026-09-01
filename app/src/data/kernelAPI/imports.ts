// 跨目录依赖转发
/** 用途：内核 SDK 客户端。使用范围：kernelAPI 模块执行 SQL 查询。解耦评估：通过 imports.ts 转发。 */
import { kernelClient } from "../kernelSDK";
/** 导出 kernelClient，供 kernelAPI 模块使用 */
export { kernelClient };

/** 用途：同步 POST 请求函数。使用范围：kernelAPI 模块调用后端 API。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "../../util/network/fetch";
/** 导出 fetchSyncPost，供 kernelAPI 模块使用 */
export { fetchSyncPost };

/** 用途：协议路径运算。使用范围：kernelAPI 模块文件路径处理。解耦评估：通过浏览器安全 POSIX 边界转发。 */
import {pathPosix} from "../../util/file/path/operations";
/** 导出 POSIX 路径工具，供 kernelAPI 模块使用。 */
export {pathPosix};

/** 用途：内核客户端类型定义。使用范围：kernelAPI 模块类型约束。解耦评估：通过 imports.ts 转发。 */
import type { KernelClientType } from "../kernelSDK";
/** 导出 KernelClientType，供 kernelAPI 模块使用 */
export type { KernelClientType };

/** 用途：内核 SDK 工厂函数。使用范围：kernelAPI 模块创建客户端实例。解耦评估：通过 imports.ts 转发。 */
import { createClient } from "@leolee9086/siyuan-kernel-sdk";
/** 导出 createClient，供 kernelAPI 模块使用 */
export { createClient };

/** 用途：内核 SDK 文件 API 定义。使用范围：kernelAPI 模块文件操作。解耦评估：通过 imports.ts 转发。 */
import { fileApiDefs } from "@leolee9086/siyuan-kernel-sdk";
/** 导出 fileApiDefs，供 kernelAPI 模块使用 */
export { fileApiDefs };
