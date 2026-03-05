/**
 * Popover 模块外部依赖转发
 * 集中管理父级目录导入，便于依赖追踪和解耦
 */

// 用途：判断元素是否在块级元素内；使用范围：refDefs.ts 中获取虚拟块引用时需要找到最近的块元素；解耦评估：工具函数，通过参数传递元素即可使用，已充分解耦
import { hasClosestBlock } from "../../protyle/util/hasClosest";
// 用途：发送同步 POST 请求到后端 API；使用范围：refDefs.ts 中所有需要从后端获取引用定义数据的场景；解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { fetchSyncPost } from "../../util/network/fetch";
// 用途：从思源协议 URL 中提取块 ID；使用范围：refDefs.ts 中处理思源协议链接时解析 ID；解耦评估：纯函数工具，通过参数传递即可使用，已充分解耦
import { getIdFromSYProtocol } from "../../util/file/pathName";

// DOM 工具函数导出
export { hasClosestBlock };
// 网络请求工具导出
export { fetchSyncPost };
// 路径解析工具导出
export { getIdFromSYProtocol };
