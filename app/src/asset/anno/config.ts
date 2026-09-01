/** 用途：发送 PDF 标注配置读写请求。使用范围：config owner 的缓存加载与持久化。解耦评估：通过 ./imports 转发基础设施边界。 */
import {fetchPost} from "./imports";
/** 用途：约束 PDF 实例。使用范围：配置缓存与文件路径访问。解耦评估：纯类型不产生运行时依赖。 */
import type {IPdfInstance} from "./anno.types";
/** 用途：约束单个 PDF 标注值。使用范围：配置记录的键值契约。解耦评估：纯类型不产生运行时依赖。 */
import type {IPdfAnno} from "./anno.types";

/**
 * PDF注释配置管理模块
 *
 * 该模块负责PDF文件注释配置的持久化存储和读取，是整个PDF注释系统的数据层核心。
 * 配置以.sya格式存储在与PDF文件相同的路径下，包含所有注释的元数据和位置信息。
 *
 * 主要功能：
 * - 注释配置的本地缓存管理
 * - 与服务器的异步数据同步
 * - 配置文件的路径解析和生成
 */

/** @同步豁免: UI构建 */
/**
 * 设置PDF文件的注释配置
 *
 * 将指定的注释数据更新到PDF配置中，并异步保存到服务器。
 * 该函数是注释创建、更新和删除操作的核心数据持久化接口。
 *
 * @param pdf PDF实例对象，包含应用配置和文件路径信息
 * @param id 注释项的唯一标识符，用作配置对象的键，对应IPdfAnno接口中的id字段
 * @param data 要存储的注释数据，符合IPdfAnno接口结构的完整注释对象
 *
 * @example
 * ```typescript
 * // 创建新的高亮注释
 * setConfig(pdfInstance, "highlight-20231125-001", {
 *   id: "highlight-20231125-001",
 *   color: "#ffff00",
 *   content: "重要内容标记",
 *   type: "text",
 *   mode: "rect",
 *   pages: [{
 *     index: 0,
 *     positions: [[100, 200, 300, 400]]
 *   }]
 * });
 * ```
 *
 * @note
 * - 该函数采用异步保存策略，不等待服务器响应完成
 * - 配置文件路径通过移除PDF文件URL的origin部分并添加.sya扩展名生成
 * - 如果配置中已存在相同id的项，会完全覆盖原有数据
 * - 该函数被anno.click.handleToolbarAction.ts中的各种操作处理器调用
 */
export const setConfig = (pdf: IPdfInstance, id: string, data: IPdfAnno) => {
    const config = getConfig(pdf);
    config[id] = data;
    fetchPost("/api/asset/setFileAnnotation", {
        path: pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya",
        data: JSON.stringify(config),
    });
};

/**
 * 处理获取配置的服务器响应
 * 
 * 解析服务器返回的注释配置数据，并更新到PDF实例的缓存中。
 * 由 getConfig 内部调用，作为 fetchPost 的回调函数。
 */
const handleGetConfigResponse = (response: IWebSocketData, pdf: IPdfInstance) => {
    let config = {};
    /**
     * 意图：只在配置文件存在时解析响应数据。
     *
     * 根据思源 API 规范：
     * - code === 0: 成功获取到配置文件
     * - code === 1: 配置文件不存在（新 PDF 或从未添加过注释）
     *
     * 生效场景：当 PDF 有已保存的注释配置时，解析服务器返回的 JSON 数据。
     * 如果是新 PDF 或无注释历史，则 config 保持为空对象 {}。
     */
    if (response.code !== 1) {
        try {
            config = JSON.parse(response.data.data);
        } catch (_error) {
            config = {};
        }
    }
    pdf.appConfig.config = config;
};

/** @同步豁免: UI构建 */
/**
 * 获取PDF文件的注释配置
 *
 * 从PDF实例的缓存中获取配置，如果缓存不存在则从服务器异步加载。
 * 该函数采用懒加载策略，只在首次调用时从服务器获取配置数据。
 *
 * @param pdf PDF实例对象，包含应用配置和文件路径信息
 * @returns 返回注释配置对象，键为注释ID，值为IPdfAnno接口对象。如果配置尚未加载完成，返回空对象
 *
 * @example
 * ```typescript
 * // 获取所有注释配置
 * const allAnnotations = getConfig(pdfInstance);
 * console.log("总注释数:", Object.keys(allAnnotations).length);
 *
 * // 遍历所有注释
 * Object.entries(allAnnotations).forEach(([id, annotation]) => {
 *   console.log(`注释 ${id}: ${annotation.content}`);
 * });
 * ```
 *
 * @note
 * - 配置加载是异步的，首次调用可能返回空对象，配置会在后台加载并更新pdf.appConfig.config
 * - 服务器响应码不为1时表示成功获取配置数据（根据思源API规范）
 * - 配置文件路径与setConfig函数使用相同的路径生成逻辑，确保数据一致性
 * - 该函数被anno.getHighlight.ts调用以渲染已保存的注释
 *
 * @warning
 * - 由于异步加载特性，不应在函数调用后立即期望获取完整的配置数据
 * - 如果需要确保配置已完全加载，应考虑使用回调或其他异步机制
 * - JSON解析失败时会静默处理，返回空配置对象
 * @显式返回类型原因 读取完成前与读取完成后都必须向注释调用方提供统一的 Record 键值契约。
 */
export const getConfig = (pdf: IPdfInstance): Record<string, IPdfAnno> => {
    if (pdf.appConfig.config) {
        return pdf.appConfig.config;
    }
    const urlPath = pdf.appConfig.file.replace(location.origin, "").substr(1) + ".sya";
    fetchPost("/api/asset/getFileAnnotation", {
        path: urlPath,
    }, (response) => handleGetConfigResponse(response, pdf));
    return pdf.appConfig.config || {};
};