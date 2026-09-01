/**
 * 用途：提供布局序列化功能，用于将标签页布局转换为JSON格式
 * 使用范围：openNewWindow 函数中序列化标签页状态
 * 解耦评估：依赖布局系统核心功能，当前无法解耦
 */
import { layoutToJSON } from "./open/imports";
/**
 * 用途：提供 IPC 通信函数，用于向 Electron 主进程发送消息
 * 使用范围：默认窗口创建函数中封装使用
 * 解耦评估：@AIDONE 已通过外观模式和参数注入解耦，调用方可通过 WindowOptions.windowCreator 自定义实现
 */
import { ipcSend } from "./open/imports";
/**
 * 用途：提供平台检测功能，用于判断是否在 Electron 环境中运行
 * 使用范围：所有导出函数中判断是否支持新窗口功能
 * 解耦评估：依赖平台检测工具函数，当前无法解耦
 */
import { isElectron } from "./open/imports";
/**
 * 用途：提供全局常量定义，用于 IPC 通信和资源类型判断
 * 使用范围：所有导出函数中使用常量
 * 解耦评估：Constants 是全局常量集合，当前无法解耦
 */
import { Constants } from "./open/imports";
/**
 * 用途：提供完整布局页签领域类型，用于页签序列化和移除
 * 使用范围：openNewWindow 函数的参数类型
 * 解耦评估：使用已双向校验的 Layout 领域根，窗口行为无需加载具体 Tab class
 */
import type {LayoutTab} from "./open/imports";
/**
 * 用途：提供网络请求功能，用于与后端API通信
 * 使用范围：openNewWindowById 函数中获取块信息
 * 解耦评估：依赖网络层实现，当前无法解耦
 */
import { fetchSyncPost } from "./open/imports";
/**
 * 用途：提供消息提示功能，用于向用户显示提示信息
 * 使用范围：openNewWindowById 函数中显示错误消息
 * 解耦评估：依赖对话框系统，当前无法解耦
 */
import { showMessage } from "./open/imports";
/**
 * 用途：提供文件路径处理功能，用于获取文件显示名称
 * 使用范围：openAssetNewWindow 函数中获取资源文件显示名称
 * 解耦评估：依赖文件系统工具函数，当前无法解耦
 */
import { getDisplayName } from "./open/imports";
/**
 * 用途：提供文件路径处理功能，用于路径操作
 * 使用范围：openAssetNewWindow 函数中提取文件扩展名
 * 解耦评估：依赖文件系统工具函数，当前无法解耦
 */
import { pathPosix } from "./open/imports";
/**
 * 用途：提供URL查询参数解析功能，用于从URL中提取参数
 * 使用范围：openAssetNewWindow 函数中解析页码参数
 * 解耦评估：依赖平台工具函数，当前无法解耦
 */
import { getSearch } from "./open/imports";
/**
 * 用途：提供窗口位置信息获取功能，用于构建新窗口URL协议部分
 * 使用范围：所有导出函数中构建新窗口URL
 * 解耦评估：依赖环境配置系统，当前无法解耦
 */
import { getLocationProtocol } from "./open/imports";
/**
 * 用途：提供窗口位置信息获取功能，用于构建新窗口URL主机部分
 * 使用范围：所有导出函数中构建新窗口URL
 * 解耦评估：依赖环境配置系统，当前无法解耦
 */
import { getLocationHost } from "./open/imports";
/**
 * 用途：上游新增 - 判断资源路径在浏览器渲染环境下是否可作为图片展示
 * 使用范围：openAssetNewWindow 中过滤不可内嵌渲染的图片资源（如 HEIC 等浏览器不支持的格式）
 * 解耦评估：上游图片能力判定工具，window/open/imports.ts 网关暂未转发，直接依赖实现模块
 */
import { isBrowserRenderableImagePath } from "../util/imageURL";

/**
 * 用途：导入窗口配置选项类型定义
 * 使用范围：所有导出函数的参数类型声明
 * 解耦评估：类型定义文件，仅用于类型检查，无运行时依赖
 */
import type { WindowOptions } from "./openNewWindow.types";
/**
 * 用途：导入窗口创建参数类型定义
 * 使用范围：默认窗口创建函数的参数类型声明
 * 解耦评估：类型定义文件，仅用于类型检查，无运行时依赖
 */
import type { WindowCreationParams } from "./openNewWindow.types";
/**
 * 用途：导入资源标签页配置类型定义
 * 使用范围：openAssetNewWindow 函数中构建资源标签页配置
 * 解耦评估：类型定义文件，仅用于类型检查，无运行时依赖
 */
import type { AssetTabConfig } from "./openNewWindow.types";

/**
 * 默认窗口创建函数（外观模式）
 * 封装 Electron IPC 通信实现，提供统一的窗口创建接口
 */
const defaultWindowCreator = (params: WindowCreationParams) => {
    // 仅在 Electron 环境中发送 IPC，避免 Web 环境误调用平台能力。
    if (isElectron) {
        ipcSend(Constants.SIYUAN_OPEN_WINDOW, params);
    }
};

/**
 * 构建窗口创建参数
 * 仅在字段显式提供时写入，避免 exactOptionalPropertyTypes 下将 undefined 传入可选字段
 */
const buildWindowCreationParams = (options: WindowOptions, url: string) => {
    const params: WindowCreationParams = { url };
    // 仅当调用方显式提供窗口位置时才写入，保持参数语义与类型约束一致。
    if (options.position !== undefined) {
        params.position = options.position;
    }
    // 仅当调用方显式提供窗口宽度时才写入，避免把 undefined 作为已定义属性值传递。
    if (options.width !== undefined) {
        params.width = options.width;
    }
    // 仅当调用方显式提供窗口高度时才写入，避免违反 exactOptionalPropertyTypes 约束。
    if (options.height !== undefined) {
        params.height = options.height;
    }
    // 仅当调用方显式设置 alwaysOnTop 标志时才写入，保持窗口置顶状态的显式控制。
    if (options.alwaysOnTop !== undefined) {
        params.alwaysOnTop = options.alwaysOnTop;
    }
    return params;
};

/**
 * 将已存在的标签页移动到新窗口中打开
 *
 * @description
 * - 作用：将当前标签页从原位置移除，并在独立的新窗口中重新打开
 * - 意图：支持多窗口工作流，允许用户将文档拖拽或移动到独立窗口进行并排查看
 * - 调用时机：
 *   1. 用户将标签页拖拽到窗口外部时（Tab.ts 中的拖拽事件）
 *   2. 用户在标签页右键菜单选择"移动到新窗口"时（tab.ts 菜单）
 *   3. 通过全局命令触发时（global.ts）
 *   4. 插件 API 调用时（openWindow.ts）
 * - 限制：仅在桌面端生效，会从原位置移除标签页
 *
 * @同步豁免: UI构建 - 此函数需要同步执行以下操作序列：
 * 1. 序列化标签页布局状态
 * 2. 发送IPC消息创建新窗口
 * 3. 从原父容器移除标签页
 * 这三个操作必须原子性完成，避免状态不一致
 *
 * @param tab - 要移动到新窗口的标签页实例
 * @param options - 窗口配置选项，包括位置、宽度、高度等
 */
export const openNewWindow = (tab: LayoutTab, options: WindowOptions = {}) => {
    const json = {};
    layoutToJSON(tab, json);
    const windowCreator = options.windowCreator ?? defaultWindowCreator;
    const url = `${getLocationProtocol()}//${getLocationHost()}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify([json]))}`;
    windowCreator(buildWindowCreationParams(options, url));
    tab.parent.removeTab(tab.id);
};

/**
 * 根据块ID在新窗口中打开文档
 *
 * @description
 * - 作用：通过块ID获取文档信息，并在独立的新窗口中打开对应的文档
 * - 意图：支持通过ID直接打开文档到新窗口，无需先创建标签页实例
 * - 调用时机：
 *   1. 用户在文档标题菜单选择"在新窗口打开"时（openTitleMenu.ts）
 *   2. 用户在引用块右键菜单选择"在新窗口打开"时（protyle.refMenu.ts）
 *   3. 用户选中多个块后通过菜单批量打开时（util.ts）
 *   4. 用户在反链面板点击"在新窗口打开"时（Panel.actions.ts）
 *   5. 插件 API 调用时（openWindow.ts）
 * - 限制：仅在桌面端生效；如果任一块ID无效会中断整个操作
 *
 * @param id - 单个块ID或块ID数组，支持批量打开多个文档
 * @param options - 窗口配置选项，包括位置、宽度、高度等
 */
export const openNewWindowById = async (id: string | string[], options: WindowOptions = {}) => {
    let ids = id;
    if (typeof ids === "string") {
        ids = [ids];
    }
    const json = [];
    for (let i = 0; i < ids.length; i++) {
        const response = await fetchSyncPost("/api/block/getBlockInfo", { id: ids[i] });
        // code === 3 表示块不存在或已被删除，此时显示错误消息并终止操作
        // 避免打开包含无效块的窗口导致用户困惑
        if (response.code === 3) {
            showMessage(response.msg);
            return;
        }
        json.push({
            title: response.data.rootTitle,
            docIcon: response.data.rootIcon,
            pin: false,
            active: true,
            instance: "Tab",
            action: "Tab",
            children: {
                notebookId: response.data.box,
                blockId: ids[i],
                rootId: response.data.rootID,
                mode: "wysiwyg",
                instance: "Editor",
                action: response.data.rootID === ids[i] ? Constants.CB_GET_SCROLL : Constants.CB_GET_ALL
            }
        });
    }
    const windowCreator = options.windowCreator ?? defaultWindowCreator;
    const url = `${getLocationProtocol()}//${getLocationHost()}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify(json))}`;
    windowCreator(buildWindowCreationParams(options, url));
};

/**
 * 根据资源文件扩展名返回对应的图标名称
 *
 * @description
 * - 作用：将文件扩展名映射为思源笔记中对应的图标标识符
 * - 意图：为资源标签页提供合适的图标显示，帮助用户快速识别资源类型
 * - 调用时机：在 openAssetNewWindow 中构建资源标签页配置时调用
 *
 * @param suffix - 文件扩展名，如 ".png"、".mp3"、".pdf" 等
 * @returns 图标名称：图片返回 "iconImage"，音频返回 "iconRecord"，
 *          视频返回 "iconVideo"，其他（主要是PDF）返回 "iconPDF"
 */
const getAssetDocIcon = (suffix: string) => {
    if (Constants.SIYUAN_ASSETS_IMAGE.includes(suffix)) {
        return "iconImage";
    }
    if (Constants.SIYUAN_ASSETS_AUDIO.includes(suffix)) {
        return "iconRecord";
    }
    if (Constants.SIYUAN_ASSETS_VIDEO.includes(suffix)) {
        return "iconVideo";
    }
    return "iconPDF";
};

/**
 * 在新窗口中打开资源文件（图片、音频、视频、PDF等）
 *
 * @description
 * - 作用：将指定的资源文件在独立的新窗口中打开，支持图片、音频、视频和PDF等多媒体资源
 * - 意图：提供资源文件的独立窗口查看能力，使用户可以在不离开当前编辑界面的情况下查看资源
 * - 调用时机：用户在资源文件右键菜单中选择"在新窗口打开"时调用（见 commonMenuItem.openMenu.ts）；
 *   上游还支持携带显式页码打开（见 editor/openLink.ts 的 openAssetByAction 新窗口分支）
 * - 限制：仅在桌面端（非浏览器环境）生效，浏览器环境下此函数为空操作
 *
 * @同步豁免: UI构建 - 此函数由用户菜单点击事件同步触发，
 * 内部仅进行数据组装和IPC消息发送，无异步操作需求，
 * 且需要保证用户点击后立即响应打开新窗口
 *
 * @param assetPath - 资源文件路径，如 "assets/image.png" 或带查询参数的路径 "assets/doc.pdf?page=5"
 * @param options - 窗口配置选项，包括位置、宽度、高度等
 * @param page - 可选的显式页码（数字或字符串），未提供时回退解析 assetPath 的 page 查询参数（上游新增）
 */
export const openAssetNewWindow = (
    assetPath: string,
    options: WindowOptions = {},
    page?: number | string,
) => {
    // 仅桌面端支持通过IPC打开资源新窗口
    if (!isElectron) {
        return;
    }
    const suffix = (pathPosix().extname(assetPath).split("?")[0] ?? "").toLowerCase();
    // 仅当文件扩展名属于思源支持的资源类型，且该路径可在浏览器环境内嵌渲染时才打开新窗口
    // （上游改进：过滤 HEIC/HEIF 等浏览器无法直接渲染的图片格式，避免打开空白窗口）
    // 非支持类型的文件静默忽略，避免打开无法渲染的内容
    if (Constants.SIYUAN_ASSETS_EXTS.includes(suffix) &&
        isBrowserRenderableImagePath(assetPath)) {
        const docIcon = getAssetDocIcon(suffix);
        const json: AssetTabConfig[] = [{
            title: getDisplayName(assetPath),
            docIcon,
            pin: false,
            active: true,
            instance: "Tab",
            action: "Tab",
            children: {
                path: assetPath,
                // 上游改进：优先使用调用方显式传入的页码；未提供时回退解析资源 URL 的 page 参数。
                // AssetTabConfig 契约目前声明为 number，显式收窄以兼容字符串页码透传。
                page: (page ?? parseInt(getSearch("page", assetPath) ?? "")) as number,
                instance: "Asset",
            }
        }];
        const windowCreator = options.windowCreator ?? defaultWindowCreator;
        const url = `${getLocationProtocol()}//${getLocationHost()}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify(json))}`;
        windowCreator(buildWindowCreationParams(options, url));
    }
};
