/**
 * 导入转发文件
 * 用途：转发父级目录的导入，避免直接使用 ../ 导入
 */

/**  用途：网络请求工具，用于通过思源代理发起HTTP请求
使用范围：client.ts 中所有需要发起网络请求的函数
解耦评估：必须保留。fetchSyncPost是核心网络层抽象，client.ts作为API客户端必须依赖网络层。
通过依赖注入需要大幅重构整个请求架构，且会增加复杂度，当前硬依赖合理。
*/
import { fetchSyncPost } from "../../util/network/fetch";

// 导出网络请求工具供client.ts使用
export { fetchSyncPost };
