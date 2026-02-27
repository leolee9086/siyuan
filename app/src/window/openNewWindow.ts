import { layoutToJSON } from "../layout/util";
import { ipcSend } from "../platform/electron/ipcRenderer";
import { isElectron } from "../platform";
import { Constants } from "../constants";
import { Tab } from "../layout/Tab";
import { fetchSyncPost } from "../util/network/fetch";
import { showMessage } from "../dialog/message";
import { getDisplayName, pathPosix } from "../util/file/pathName";
import { getSearch } from "../util/platform/functions";
import { getLocationProtocol, getLocationHost } from "../util/siyuanEnvironments/windowLocation.environment";
import type { WindowOptions, AssetTabConfig } from "./openNewWindow.types";

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
export const openNewWindow = (tab: Tab, options: WindowOptions = {}) => {
    const json = {};
    layoutToJSON(tab, json);
    // 仅桌面端支持通过IPC创建新窗口
    if (isElectron) {
        ipcSend(Constants.SIYUAN_OPEN_WINDOW, {
            position: options.position,
            width: options.width,
            height: options.height,
            // 需要 encode， 否则 https://github.com/siyuan-note/siyuan/issues/9343
            url: `${getLocationProtocol()}//${getLocationHost()}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify([json]))}`
        });
    }
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
    // 仅桌面端支持通过IPC创建新窗口
    if (isElectron) {
        ipcSend(Constants.SIYUAN_OPEN_WINDOW, {
            position: options.position,
            width: options.width,
            height: options.height,
            url: `${getLocationProtocol()}//${getLocationHost()}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify(json))}`
        });
    }
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
const getAssetDocIcon = (suffix: string): string => {
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
 * - 调用时机：用户在资源文件右键菜单中选择"在新窗口打开"时调用（见 commonMenuItem.openMenu.ts）
 * - 限制：仅在桌面端（非浏览器环境）生效，浏览器环境下此函数为空操作
 *
 * @同步豁免: UI构建 - 此函数由用户菜单点击事件同步触发，
 * 内部仅进行数据组装和IPC消息发送，无异步操作需求，
 * 且需要保证用户点击后立即响应打开新窗口
 *
 * @param assetPath - 资源文件路径，如 "assets/image.png" 或带查询参数的路径 "assets/doc.pdf?page=5"
 * @param options - 窗口配置选项，包括位置、宽度、高度等
 */
export const openAssetNewWindow = (assetPath: string, options: WindowOptions = {}) => {
    // 仅桌面端支持通过IPC打开资源新窗口
    if (!isElectron) {
        return;
    }
    const suffix = pathPosix().extname(assetPath).split("?")[0] ?? "";
    // 仅当文件扩展名属于思源支持的资源类型（图片、音视频、PDF）时才打开新窗口
    // 非支持类型的文件静默忽略，避免打开无法渲染的内容
    if (Constants.SIYUAN_ASSETS_EXTS.includes(suffix)) {
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
                page: parseInt(getSearch("page", assetPath) ?? ""),
                instance: "Asset",
            }
        }];
        ipcSend(Constants.SIYUAN_OPEN_WINDOW, {
            position: options.position,
            width: options.width,
            height: options.height,
            url: `${getLocationProtocol()}//${getLocationHost()}/stage/build/app/window.html?v=${Constants.SIYUAN_VERSION}&json=${encodeURIComponent(JSON.stringify(json))}`
        });
    }
};
