/** 用途：提供剪贴板协议标识；使用范围：Electron 富文本写入流程；解耦评估：协议常量必须与内核共享，局部注入会造成命令漂移。 */
import {Constants} from "./richClipboard/imports";
/** 用途：判断当前运行目标是否为 Electron；使用范围：选择原生剪贴板增强路径；解耦评估：平台能力由统一环境模块提供，无法由调用方可靠推断。 */
import {isElectron} from "./richClipboard/imports";
/** 用途：调用 Electron IPC；使用范围：登记、完成和取消富文本剪贴板；解耦评估：IPC 通道是唯一主进程边界，事件广播不能返回写入结果。 */
import {ipcInvoke} from "./richClipboard/imports";
/** 用途：取得剪贴板入口选项契约；使用范围：增强请求参数；解耦评估：纯类型依赖，参数对象仍需共享同一字段定义。 */
import type {IRichClipboardOptions} from "./richClipboard/types";
/** 用途：取得剪贴板准备结果契约；使用范围：内核响应处理；解耦评估：纯类型依赖，必须与 guard 使用同一结构。 */
import type {IRichClipboardPrepared} from "./richClipboard/types";
/** 用途：取得剪贴板源行契约；使用范围：资源替换流程；解耦评估：纯类型依赖，集中定义可避免 DOM 入口间字段漂移。 */
import type {IRichClipboardSource} from "./richClipboard/types";
/** 用途：校验内核准备结果；使用范围：资源替换前的运行时边界；解耦评估：守卫集中在 guard 文件，避免业务流程承担不安全断言。 */
import {isRichClipboardPrepared} from "./richClipboard/richClipboard.guards";
/** 用途：校验内核 HTTP 响应信封；使用范围：准备阶段数据边界；解耦评估：运行时结构必须集中守卫，避免业务流程使用断言。 */
import {isRichClipboardResponse} from "./richClipboard/richClipboard.guards";
/** 用途：检测剪贴板数学内容；使用范围：复制增强条件判断；解耦评估：DOM 识别由规范化模块统一维护。 */
import {hasRichClipboardMath} from "./richClipboard/normalize";
/** 用途：检测剪贴板表格内容；使用范围：复制增强条件判断；解耦评估：DOM 识别由规范化模块统一维护。 */
import {hasRichClipboardTables} from "./richClipboard/normalize";
/** 用途：规范化外部剪贴板 HTML；使用范围：编辑器与预览复制流程；解耦评估：DOM 转换需由专责模块维护。 */
import {prepareExternalClipboardHTML} from "./richClipboard/normalize";
/** 用途：规范化内部剪贴板 HTML；使用范围：资源准备请求；解耦评估：内部标记协议必须与资源替换逻辑共用实现。 */
import {prepareRichClipboardHTML} from "./richClipboard/normalize";
/** 用途：提取本地图片资源源行；使用范围：Electron 资源批处理；解耦评估：提取逻辑依赖 DOM 结构，集中封装可避免各复制入口重复解析。 */
import {getRichClipboardSources} from "./richClipboard/sources";
/** 用途：检测 HTML 是否包含本地图片；使用范围：复制事件快速退出；解耦评估：复用源提取器保证检测与替换条件一致。 */
import {hasRichClipboardImages} from "./richClipboard/sources";

const richClipboardPrepareURL = "/api/clipboard/prepareRichText";
const richClipboardCleanupURL = "/api/clipboard/cleanupRichText";

/** 对外保持原有剪贴板工具入口，内部实现按职责拆分。 */
export {
    hasRichClipboardMath,
    hasRichClipboardTables,
    hasRichClipboardImages,
    prepareExternalClipboardHTML,
    prepareRichClipboardHTML,
};

/** 向内核剪贴板接口发送 JSON 请求，并返回其响应载荷。 */
const postRichClipboard = async (url: string, data: Record<string, unknown>) => {
    const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
    });
    return response.json();
};

/** 取消 Electron 中尚未完成的富文本剪贴板事务。 */
const cancelRichClipboard = async (token: string) => {
    try {
        await ipcInvoke(Constants.SIYUAN_GET, {cmd: "cancelRichClipboard", token});
    } catch (error) {
        console.warn("Cancel rich clipboard error:", error);
    }
};

/** 通过内核批次接口清理准备阶段生成的临时资源。 */
const cleanupRichClipboard = async (prepared: IRichClipboardPrepared) => {
    try {
        await postRichClipboard(richClipboardCleanupURL, {
            batch: prepared.batch,
            groups: prepared.groups,
        });
    } catch (error) {
        console.warn("Cleanup rich clipboard error:", error);
    }
};

/** 向 Electron 请求开始一次受校验的系统剪贴板事务。 */
const beginRichClipboard = async (text: string, marker: string) => {
    try {
        const token = await ipcInvoke<unknown>(Constants.SIYUAN_GET, {
            cmd: "beginRichClipboard",
            text,
            marker,
        });
        return typeof token === "string" ? token : "";
    } catch (error) {
        console.warn("Begin rich clipboard error:", error);
        return "";
    }
};

/** 请求内核准备图片资源，并通过运行时守卫返回可信批次数据。 */
const prepareRichClipboard = async (sources: IRichClipboardSource[]) => {
    try {
        const response = await postRichClipboard(richClipboardPrepareURL, {
            assets: sources.map(source => ({
                index: source.index,
                path: source.path,
                box: source.box,
            })),
        });
        // 只有成功信封且 data 结构完整时才允许进入文件替换阶段。
        if (!isRichClipboardResponse(response) || response.code !== 0 || !isRichClipboardPrepared(response.data)) {
            return;
        }
        return response.data;
    } catch (error) {
        console.warn("Prepare rich clipboard error:", error);
    }
};

/** 将源图片节点改为内核批次占位路径，并生成完成请求的替换表。 */
const replaceRichClipboardAssets = (
    sources: IRichClipboardSource[],
    prepared: IRichClipboardPrepared,
) => {
    const replacements: {placeholder: string; path: string}[] = [];
    const preparedIndexes = new Set<number>();
    for (const asset of prepared.assets) {
        const source = sources[asset.index];
        if (!source || preparedIndexes.has(asset.index) || !asset.path) {
            return;
        }
        preparedIndexes.add(asset.index);
        const placeholder = `siyuan-rich-clipboard-${prepared.batch}-${asset.index}`;
        source.element.setAttribute("src", placeholder);
        replacements.push({placeholder, path: asset.path});
    }
    if (preparedIndexes.size !== sources.length) {
        return;
    }
    return replacements;
};

/** 将替换后的 HTML 交给 Electron 完成系统剪贴板写入。 */
// @柯里化：固定 Electron 通道与完成命令，调用方只提供当前事务数据。
const completeRichClipboard = async (options: {
    token: string;
    text: string;
    html: string;
    replacements: {placeholder: string; path: string}[];
}) => ipcInvoke<boolean>(Constants.SIYUAN_GET, {
    cmd: "completeRichClipboard",
    token: options.token,
    text: options.text,
    html: options.html,
    replacements: options.replacements,
});

/** 执行一次本地图片富文本增强，失败时取消并清理内核临时资源。 */
const runRichClipboardEnhancement = async (request: {
    text: string;
    html: string;
    notebookID: string;
    options: IRichClipboardOptions;
}) => {
    const {text, html, notebookID, options} = request;
    const template = document.createElement("template");
    template.innerHTML = html;
    const sources = getRichClipboardSources(template, notebookID);
    if (sources.length === 0 || sources.length > 1024) {
        return;
    }
    const marker = options.marker || html.match(/<!--data-siyuan='[^']+'-->/)?.[0];
    if (!marker) {
        return;
    }
    const token = await beginRichClipboard(text, marker);
    if (!token) {
        return;
    }
    const prepared = await prepareRichClipboard(sources);
    if (!prepared) {
        await cancelRichClipboard(token);
        return;
    }
    const replacements = replaceRichClipboardAssets(sources, prepared);
    if (!replacements) {
        await cleanupRichClipboard(prepared);
        await cancelRichClipboard(token);
        return;
    }
    const clipboardHTML = options.removeMarker ? template.innerHTML.replace(marker, "") : template.innerHTML;
    try {
        const written = await completeRichClipboard({
            token,
            text,
            html: clipboardHTML,
            replacements,
        });
        if (!written) {
            await cleanupRichClipboard(prepared);
        }
    } catch (error) {
        await cleanupRichClipboard(prepared);
        console.warn("Complete rich clipboard error:", error);
    }
};

/** 将本地图片资源交给 Electron 与内核处理，使外部粘贴获得可用文件 URL。 */
/** @同步豁免: 遗留代码 */
export const enhanceRichClipboard = (request: {
    text: string;
    html: string;
    notebookID: string;
    options?: IRichClipboardOptions;
}) => {
    if (!isElectron) {
        return;
    }
    const {text, html, notebookID, options = {}} = request;
    if (!hasRichClipboardImages(html)) {
        return;
    }
    // 当前复制事件完成后再启动 IPC，确保主进程读取到刚写入的 clipboard 内容。
    window.setTimeout(() => {
        void runRichClipboardEnhancement({text, html, notebookID, options});
    }, 0);
};
