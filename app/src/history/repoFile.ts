/** 用途：生成历史资源快照的媒体预览 HTML。使用范围：仅处理历史文件预览中的图片、音频和视频。解耦评估：可注入渲染器，但该纯展示依赖不形成反向所有权关系。 */
import {renderAssetsPreview} from "./imports";
/** 用途：识别历史快照的媒体类型和编辑器动作常量。使用范围：历史预览的内容分发与只读编辑器构造。解耦评估：常量不持有运行时状态，端口不会降低耦合。 */
import {Constants} from "./imports";
/** 用途：在回滚前请求用户确认。使用范围：历史文件回滚操作。解耦评估：该交互由历史 UI 直接拥有，注入对单一点击路径没有收益。 */
import {confirmDialog} from "./imports";
/** 用途：描述历史仓库快照条目。使用范围：历史文件列表的三个条目渲染 helper。 */
import type {IHistoryRepoFile} from "./history.docEvent.types";
/** 用途：描述文档快照预览的创建请求。使用范围：把已收到的文档响应交给只读编辑器 helper。 */
import type {TRepoFileDocumentRenderRequest} from "./history.docEvent.types";
/** 用途：描述当前快照响应仍有效时所需上下文。使用范围：网络响应 handler 过滤过期预览。 */
import type {TRepoFileResponseRequest} from "./history.docEvent.types";
/** 用途：将内核导出路径交给宿主保存。使用范围：历史文件导出点击操作。解耦评估：平台保存由既有兼容层统一，直接调用避免历史层了解宿主实现。 */
import {saveExportFile} from "./imports";
/** 用途：创建历史文档的只读编辑器。使用范围：非媒体、非纯文本快照预览。解耦评估：历史预览是该编辑器生命周期的组合层，当前无更低层端口可替代。 */
import {disabledProtyle} from "./imports";
/** 用途：消费文档快照内容响应。使用范围：只读历史编辑器的初始化收尾。解耦评估：历史组合层仅调用既有编辑器响应协议，不向编辑器实现反向暴露历史状态。 */
import {onGet} from "./imports";
/** 用途：转义历史文件的数据属性。使用范围：比较模式列表条目的标题属性。解耦评估：无状态安全工具，不应通过 UI 端口间接调用。 */
import {escapeAttr} from "./imports";
/** 用途：转义历史文件的显示文本。使用范围：移动和桌面列表条目的标题与路径。解耦评估：无状态安全工具，不应通过 UI 端口间接调用。 */
import {escapeHtml} from "./imports";
/** 用途：请求仓库历史和导出接口。使用范围：回滚、导出与快照打开操作。解耦评估：应用已有统一 HTTP 边界，额外注入会重复同一抽象。 */
import {fetchPost} from "./imports";
/** 用途：选择移动端或桌面端历史条目结构。使用范围：历史文件列表渲染。解耦评估：平台探测为无状态基础能力，传参不会减少耦合。 */
import {isMobile} from "./imports";
/** 用途：读取快照内容的扩展名。使用范围：媒体、文本和文档预览分发。解耦评估：路径工具无状态且不依赖历史所有者。 */
import {pathPosix} from "./imports";
/** 用途：格式化快照创建时间。使用范围：历史文件列表和回滚确认文本。解耦评估：第三方纯日期工具不存在可反转的业务依赖。 */
import {dayjs} from "./imports";

/** 历史快照预览请求序号的全局生命周期键，避免模块重载产生相互独立的过期响应判定。 */
const repoFileRequestIdKey = Symbol.for("sforge.history.repoFileRequestId");

/** 作用：分配下一个历史快照预览请求序号。意图：跨 HMR 模块实例保留过期响应屏蔽状态。调用时机：开始打开新的历史快照前。 */
const getNextRepoFileRequestId = () => {
    const storedRequestId = Reflect.get(globalThis, repoFileRequestIdKey);
    const nextRequestId = typeof storedRequestId === "number" && Number.isSafeInteger(storedRequestId)
        ? storedRequestId + 1
        : 1;
    Reflect.set(globalThis, repoFileRequestIdKey, nextRequestId);
    return nextRequestId.toString();
};

/** 作用：渲染可比较的历史版本列表项。意图：保留版本选择、回滚和导出操作入口。调用时机：历史面板进入比较模式时。 */
const renderComparableRepoFileItem = (item: IHistoryRepoFile) => `<li class="b3-list-item b3-list-item--hide-action" data-type="searchFileItem" data-id="${item.fileID}" data-snapshot="${item.indexID}" data-created="${item.updated}" data-title="${escapeAttr(item.title)}">
    <span class="b3-list-item__text">${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}</span>
    <span class="fn__space"></span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${window.siyuan.languages.rollback}">
        <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="saveAs" aria-label="${window.siyuan.languages.saveAs}">
        <svg><use xlink:href="#iconDownload"></use></svg>
    </span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="selectVersion" aria-pressed="false" aria-label="${window.siyuan.languages.compare}">
        <svg><use xlink:href="#iconUncheck"></use></svg>
    </span>
</li>`;

/** 作用：渲染移动端历史文件列表项。意图：在窄屏内保留标题、时间、大小和文字操作。调用时机：移动端历史文件列表刷新时。 */
const renderMobileRepoFileItem = (item: IHistoryRepoFile) => `<li class="b3-list-item" data-type="searchFileItem" data-id="${item.fileID}" data-snapshot="${item.indexID}" data-created="${item.updated}">
    <div class="fn__flex-1">
        <div style="padding-top:8px" class="b3-list-item__text">${escapeHtml(item.title)}</div>
        <div class="b3-list-item__meta">
            ${item.hSize}
            <span class="fn__space"></span>
            ${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}
        </div>
        <div class="fn__flex" style="height: 26px">
            <span class="fn__flex-1"></span>
            <span class="b3-list-item__action" data-type="saveAs">
                <svg><use xlink:href="#iconDownload"></use></svg>
                <span class="fn__space"></span>${window.siyuan.languages.saveAs}
            </span>
            <span class="fn__space"></span>
            <span class="b3-list-item__action" data-type="rollback">
                <svg><use xlink:href="#iconUndo"></use></svg>
                <span class="fn__space"></span> ${window.siyuan.languages.rollback}
            </span>
        </div>
    </div>
</li>`;

/** 作用：渲染桌面端历史文件列表项。意图：在宽屏内展示可选路径以及紧凑图标操作。调用时机：桌面历史文件列表刷新时。 */
const renderDesktopRepoFileItem = (item: IHistoryRepoFile, pathHTML: string) => `<li class="b3-list-item b3-list-item--hide-action" data-type="searchFileItem" data-id="${item.fileID}" data-snapshot="${item.indexID}" data-created="${item.updated}">
    <div class="fn__flex-1">
        <span class="b3-list-item__text">${escapeHtml(item.title)}</span>
        <div class="b3-list-item__meta">
            ${pathHTML}${item.hSize}
            <span class="fn__space"></span>
            ${dayjs(item.updated).format("YYYY-MM-DD HH:mm:ss")}
        </div>
    </div>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="saveAs" aria-label="${window.siyuan.languages.saveAs}">
        <svg><use xlink:href="#iconDownload"></use></svg>
    </span>
    <span class="b3-list-item__action b3-tooltips b3-tooltips__w" data-type="rollback" aria-label="${window.siyuan.languages.rollback}">
        <svg><use xlink:href="#iconUndo"></use></svg>
    </span>
</li>`;

/** 作用：按当前历史列表模式选择单项标记。意图：让比较、移动端和桌面端的 HTML 构造保持独立。调用时机：批量渲染历史文件列表时。 */
const renderRepoFileListItem = (item: IHistoryRepoFile, showPath: boolean, showCompare: boolean) => {
    // 比较模式的行包含版本选择状态和额外的回滚、导出入口。
    if (showCompare) {
        return renderComparableRepoFileItem(item);
    }
    const pathHTML = showPath && item.hPath ? `${escapeHtml(item.hPath)}<span class="fn__space"></span>` : "";
    // 移动端保留显式文字操作，桌面端使用紧凑图标操作。
    if (isMobile()) {
        return renderMobileRepoFileItem(item);
    }
    return renderDesktopRepoFileItem(item, pathHTML);
};

/**
 * 作用：渲染历史快照文件列表。
 * 意图：统一空态和各平台条目构造。
 * 调用时机：历史文档或仓库面板刷新时。
 * @同步豁免: 需要绝对同步的DOM访问 - 调用方会紧接着插入当前版本行，列表必须在该语句之前完成 DOM 替换。
 */
export const renderRepoFileList = (request: {
    files: IHistoryRepoFile[],
    element: Element,
    showPath: boolean,
    showCompare?: boolean,
}) => {
    const {files, element, showPath, showCompare = false} = request;
    // 历史查询无结果时必须渲染空态，避免保留上一页的过期版本行。
    if (files.length === 0) {
        element.innerHTML = `<li class="b3-list--empty">${window.siyuan.languages.emptyContent}</li>`;
        return;
    }
    element.innerHTML = files.map(item => renderRepoFileListItem(item, showPath, showCompare)).join("");
};

/**
 * 作用：请求回滚选定历史快照文件。
 * 意图：在只读保护之外保留原有确认对话框和恢复端点。
 * 调用时机：历史列表的回滚操作被点击时。
 * @同步豁免: 遗留代码 - 点击委托当前以 void 事件处理 API 调用；改变其返回契约会扩散到历史面板的操作分发。
 */
export const rollbackRepoFile = (element: Element) => {
    if (window.siyuan.config.readonly) {
        return;
    }

    const titleElement = element.querySelector(".b3-list-item__text");
    const name = element.getAttribute("data-title") || titleElement?.textContent?.trim() || "";
    const time = dayjs(parseInt(element.getAttribute("data-created"))).format("YYYY-MM-DD HH:mm:ss");
    confirmDialog("⚠️ " + window.siyuan.languages.rollback,
        window.siyuan.languages.rollbackConfirm.replace("${name}", name).replace("${time}", time),
        () => {
            fetchPost("/api/repo/rollbackRepoSnapshotFile", {
                id: element.getAttribute("data-id")
            });
        });
};

/**
 * 作用：导出选定历史快照文件。
 * 意图：通过平台保存行为交付内核返回的导出路径。
 * 调用时机：历史列表的导出操作被点击时。
 * @同步豁免: 遗留代码 - 点击委托以 void 操作 API 启动回调式导出，改为 Promise 会改变既有事件分发契约。
 */
export const saveRepoFile = (element: Element) => {
    const id = element.getAttribute("data-id");
    // 缺失快照 ID 的行不能提交导出请求，避免内核将空值解释为其它资源。
    if (!id) {
        return;
    }
    fetchPost("/api/repo/exportRepoFile", {
        id
    }, (response) => {
        saveExportFile(response.data.path);
    });
};

/** 作用：把已取得的文档快照装配为只读编辑器。意图：将编辑器创建与网络回调分离，保持预览收尾可独立验证。调用时机：快照不是资源或纯文本时。 */
const renderRepoFileDocument = (request: TRepoFileDocumentRenderRequest) => {
    const editorElement = request.contentElement.firstElementChild;
    if (!(editorElement instanceof HTMLElement)) {
        return;
    }
    const viewEditor = request.app.createProtyle(editorElement, {
        blockId: "",
        action: [Constants.CB_GET_HISTORY],
        history: {
            snapshot: request.snapshotId
        },
        render: {
            background: false,
            gutter: false,
            breadcrumb: false,
            breadcrumbDocName: false,
        },
        typewriterMode: false
    });
    disabledProtyle(viewEditor.protyle);
    request.onEditor?.(viewEditor);
    onGet({
        data: request.response,
        protyle: viewEditor.protyle,
        action: [Constants.CB_GET_HISTORY, Constants.CB_GET_HTML],
    });
};

/** 作用：将纯文本快照写入只读文本框。意图：避免文本内容经过块级编辑器渲染。调用时机：内核标记快照应按文本展示时。 */
const writeRepoFileTextPreview = (contentElement: Element, content: string, title: string) => {
    contentElement.innerHTML = '<textarea readonly class="b3-text-field fn__block" style="height: 100%"></textarea>';
    const textArea = contentElement.firstElementChild;
    // 模板固定写入 textarea，但仍在 DOM 被扩展或替换时避免错误写入非文本节点。
    if (textArea instanceof HTMLTextAreaElement) {
        textArea.value = content || title;
    }
};

/** 作用：将多媒体快照写入资源预览容器。意图：资源预览无需创建只读编辑器。调用时机：快照扩展名属于内置媒体类型时。 */
const writeRepoFileAssetPreview = (contentElement: Element, content: string) => {
    const previewElement = contentElement.firstElementChild;
    if (!(previewElement instanceof HTMLElement)) {
        return;
    }
    previewElement.innerHTML = renderAssetsPreview(content);
};

/** 作用：处理当前历史快照文件的内核响应。意图：拒绝过期预览并按资源、文本和文档类型分发。调用时机：打开快照文件请求返回时。 */
const handleRepoFileResponse = (request: TRepoFileResponseRequest, response: IWebSocketData) => {
    const {app, contentElement, onEditor, requestId, snapshotId} = request;
    if (!contentElement.isConnected || contentElement.getAttribute("data-request-id") !== requestId) {
        return;
    }
    const type = pathPosix().extname(response.data.content).toLowerCase();
    // 多媒体快照直接写入资源预览，避免不必要地创建只读编辑器。
    if (Constants.SIYUAN_ASSETS_IMAGE.concat(Constants.SIYUAN_ASSETS_AUDIO).concat(Constants.SIYUAN_ASSETS_VIDEO).includes(type)) {
        writeRepoFileAssetPreview(contentElement, response.data.content);
        return;
    }
    // 文本快照使用只读文本框，以保留原始内容而不经过块级渲染。
    if (response.data.displayInText) {
        writeRepoFileTextPreview(contentElement, response.data.content, response.data.title);
        return;
    }
    renderRepoFileDocument({app, contentElement, snapshotId, response, onEditor});
};

/**
 * 作用：打开并渲染一个历史快照文件。
 * 意图：按资源、文本和文档三种内容类型保持既有预览行为。
 * 调用时机：历史面板点击文件时。
 * @同步豁免: 需要绝对同步的DOM访问 - 必须立即更新请求 ID 和加载容器，才能拒绝旧请求响应并保持当前选中项的预览。
 */
export const renderRepoFile = (request: TRepoFileRenderRequest) => {
    const {app, element, contentElement, onEditor} = request;
    const fileId = element.getAttribute("data-id");
    const snapshotId = element.getAttribute("data-snapshot") || "";
    const requestId = getNextRepoFileRequestId();
    contentElement.setAttribute("data-id", fileId);
    contentElement.setAttribute("data-request-id", requestId);
    contentElement.innerHTML = '<div style="border-radius: var(--b3-border-radius-b);"></div>';
    const responseRequest = {app, contentElement, onEditor, requestId, snapshotId};
    fetchPost("/api/repo/openRepoSnapshotFile", {
        id: fileId
    }, (response) => handleRepoFileResponse(responseRequest, response));
};
