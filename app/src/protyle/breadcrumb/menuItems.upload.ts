/**
 * 面包屑菜单项辅助函数 - 上传与录音
 * 从 menuItems.ts 提取的上传和录音相关菜单项创建函数
 */
import { Constants } from "../../constants";
import { Menu } from "../../menus/Menu";
import { MenuItem } from "../../menus/Menu.Item";
import { RecordMedia } from "../util/RecordMedia";
import { hideMessage, showMessage } from "../../dialog/message";
import { uploadFiles } from "../upload";
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanMenus } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { 录音器上下文 } from "./breadcrumb.types";
import { isHTMLInputElement } from "./breadcrumb.guard";

// ==================== 上传菜单项 ====================

function 处理上传变更事件(protyle: IProtyle, event: Event): void {
    if (!isHTMLInputElement(event.target)) {
        return;
    }
    const { files } = event.target;
    if (!files || files.length === 0) {
        return;
    }
    uploadFiles(protyle, files, event.target);
    getSiyuanMenus()?.menu.remove();
}

export function 添加上传菜单项(protyle: IProtyle, menu: Menu): void {
    const accept = protyle.options?.upload?.accept;
    const acceptAttr = accept ? ` accept="${accept}"` : "";
    const uploadHTML = `<input class="b3-form__upload" type="file" multiple="multiple"${acceptAttr}>`;

    const uploadMenu = new MenuItem({
        id: "insertAsset",
        icon: "iconDownload",
        label: `${siyuanI18n.insertAsset}${uploadHTML}`,
    }).element;

    const inputElement = uploadMenu.querySelector("input");
    if (inputElement) {
        inputElement.addEventListener("change", (event) => 处理上传变更事件(protyle, event));
    }

    menu.append(uploadMenu);
}

// ==================== 录音菜单项 ====================

/**
 * 检查 macOS 麦克风权限
 * @returns true 表示可以继续录音，false 表示权限被拒绝
 */
async function 检查macOS麦克风权限(os: string | undefined): Promise<boolean> {
    /// #if !BROWSER
    if (os !== "darwin") {
        return true;
    }

    const status = await ipcRenderer.invoke(Constants.SIYUAN_GET, { cmd: "getMicrophone" });
    if (["denied", "restricted", "unknown"].includes(status)) {
        showMessage(siyuanI18n.microphoneDenied);
        return false;
    }

    if (status !== "not-determined") {
        return true;
    }

    const isAccess = await ipcRenderer.invoke(Constants.SIYUAN_GET, { cmd: "askMicrophone" });
    if (!isAccess) {
        showMessage(siyuanI18n.microphoneNotAccess);
        return false;
    }
    return true;
    /// #endif
    /// #if BROWSER
    return true;
    /// #endif
}

function 初始化新录音器(
    protyle: IProtyle,
    setMediaRecorder: 录音器上下文["setMediaRecorder"],
    startRecord: 录音器上下文["startRecord"]
): void {
    // @内联回调
    navigator.mediaDevices.getUserMedia({ audio: true }).then((mediaStream: MediaStream) => {
        const newRecorder = new RecordMedia(mediaStream);
        newRecorder.recorder.onaudioprocess = (e: AudioProcessingEvent) => {
            if (!newRecorder.isRecording) {
                return;
            }
            const left = e.inputBuffer.getChannelData(0);
            const right = e.inputBuffer.getChannelData(1);
            newRecorder.cloneChannelData(left, right);
        };
        setMediaRecorder(newRecorder);
        startRecord(protyle);
    }).catch(() => {
        showMessage(siyuanI18n["record-tip"]);
    });
}

function 停止录音并上传(protyle: IProtyle, mediaRecorder: RecordMedia, messageId: string): void {
    mediaRecorder.stopRecording();
    hideMessage(messageId);
    const file = new File(
        [mediaRecorder.buildWavFileBlob()],
        `record${Date.now()}.wav`,
        { type: "video/webm" }
    );
    uploadFiles(protyle, [file]);
}

export function 添加录音菜单项(
    protyle: IProtyle,
    menu: Menu,
    录音上下文: 录音器上下文
): void {
    const { mediaRecorder, messageId, startRecord, setMediaRecorder } = 录音上下文;
    const siyuanConfig = getSiyuanConfig();
    const isRecording = mediaRecorder?.isRecording ?? false;

    menu.append(new MenuItem({
        id: isRecording ? "endRecord" : "startRecord",
        current: isRecording,
        icon: "iconRecord",
        label: isRecording ? siyuanI18n.endRecord : siyuanI18n.startRecord,
        click: async () => {
            const hasPermission = await 检查macOS麦克风权限(siyuanConfig.system?.os);
            if (!hasPermission) {
                return;
            }

            if (!mediaRecorder) {
                初始化新录音器(protyle, setMediaRecorder, startRecord);
                return;
            }

            if (mediaRecorder.isRecording) {
                停止录音并上传(protyle, mediaRecorder, messageId);
                return;
            }

            hideMessage(messageId);
            startRecord(protyle);
        }
    }).element);
}
