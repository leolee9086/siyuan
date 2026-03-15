/**
 * AI配置模块导入转发文件
 * 用途：转发父级目录的导入，避免直接使用 ../ 导入
 */

/**
 * 用途：提交ModelScope文生图任务
 * 使用范围：ModelScopeConfig.vue 中的测试生成功能
 * 解耦评估：必须保留。配置界面需要调用API进行功能测试，直接依赖合理
 */
import { 提交生成任务 } from "../../apis/modelscope/client";

/**
 * 用途：轮询ModelScope任务状态直到完成
 * 使用范围：ModelScopeConfig.vue 中的测试生成功能
 * 解耦评估：必须保留。配置界面需要等待任务完成以验证配置，直接依赖合理
 */
import { 轮询任务直到完成 } from "../../apis/modelscope/client";

/**
 * 用途：获取ModelScope生成的图片
 * 使用范围：ModelScopeConfig.vue 中的测试生成功能
 * 解耦评估：必须保留。配置界面需要获取图片以展示结果，直接依赖合理
 */
import { 获取图片 } from "../../apis/modelscope/client";

/**
 * 用途：从任务状态中提取图片URL
 * 使用范围：ModelScopeConfig.vue 中的测试生成功能
 * 解耦评估：必须保留。配置界面需要提取URL以获取图片，直接依赖合理
 */
import { 提取图片URL } from "../../apis/modelscope/client";

// 导出ModelScope API函数供配置界面使用
export { 提交生成任务 };
// 导出轮询函数
export { 轮询任务直到完成 };
// 导出图片获取函数
export { 获取图片 };
// 导出URL提取函数
export { 提取图片URL };
