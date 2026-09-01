/**
 * 面包屑菜单项辅助函数 - 上传与录音
 * 从 menuItems.ts 提取的上传和录音相关菜单项创建函数
 */
import { Constants } from "../../../constants";
import { Menu } from "../../../menus/Menu";
import { MenuItem } from "../../../menus/Menu.Item";
import { RecordMedia } from "../../util/RecordMedia";
import { hideMessage, showMessage } from "../../runtime/dialog.port";
import {uploadFiles} from "../../upload/transport";
import { isElectron } from "../../../platform";
import { ipcInvoke } from "../../../platform/electron/ipcRenderer";
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getSiyuanConfig, getSiyuanMenus } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
import type { 录音器上下文 } from "../breadcrumb.types";
import { isHTMLInputElement } from "../imports";
import { isInAndroid, isInHarmony } from "../../util/compatibility";
import { RecordMediaInputEndedError } from "../../util/RecordMedia";

// ==================== 上传菜单项 ====================

/**
 * 处理文件上传 input 的 change 事件
 *
 * 作用：从 change 事件中提取用户选择的文件列表，调用 uploadFiles 上传到 protyle，并关闭菜单
 * 意图：将上传 input 的事件处理逻辑封装为独立函数，便于在菜单项中绑定事件监听
 * 调用时机：由 添加上传菜单项 中创建的 file input 元素的 change 事件触发
 */
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

/**
 * 向面包屑菜单添加指定类型的文件选择项
 *
 * 作用：根据配置创建包含 file input 的菜单项，并复用统一的上传事件处理。
 * 意图：让 Android 图片选择与通用资源选择共享完全相同的 DOM 和上传逻辑。
 * 调用时机：由 menuItems.misc.ts 的 添加上传与录音组 在构建面包屑右键菜单时调用
 *
 * @同步豁免: UI构建 - 函数职责是同步构建 MenuItem DOM 元素并 append 到菜单，
 *   调用方 添加上传与录音组 按顺序同步组装菜单，无法使用异步
 */
function 添加文件选择菜单项(
    protyle: IProtyle,
    menu: Menu,
    options: {id: string; icon: string; label: string; accept?: string},
) {
    const acceptAttr = options.accept ? ` accept="${options.accept}"` : "";
    const uploadHTML = `<input class="b3-form__upload" type="file" multiple="multiple"${acceptAttr}>`;

    const uploadMenu = new MenuItem({
        id: options.id,
        icon: options.icon,
        label: `${options.label}${uploadHTML}`,
    }).element;

    const inputElement = uploadMenu.querySelector("input");
    if (inputElement) {
        inputElement.addEventListener("change", (event) => 处理上传变更事件(protyle, event));
    }

    menu.append(uploadMenu);
}

/**
 * 作用：添加当前宿主可用的资源选择入口。
 * 意图：Android 额外提供系统图片选择器，其他宿主仍保持通用资源选择。
 * 调用时机：面包屑菜单构建上传分组时。
 */
// 导出说明：面包屑菜单的统一上传入口构建器。
export function 添加上传菜单项(protyle: IProtyle, menu: Menu) {
    // Android 支持原生图片选择协议，因此在通用资源入口之前增加专用图片入口。
    if (isInAndroid()) {
        添加文件选择菜单项(protyle, menu, {
            id: "insertImage",
            icon: "iconImage",
            label: siyuanI18n.insertImage,
            accept: "image/*,application/x-siyuan-image-picker",
        });
    }
    添加文件选择菜单项(protyle, menu, {
        id: "insertAsset",
        icon: "iconDownload",
        label: siyuanI18n.insertAsset,
        accept: protyle.options?.upload?.accept,
    });
}

// ==================== 录音菜单项 ====================

/**
 * 检查 macOS 麦克风权限
 * @returns true 表示可以继续录音，false 表示权限被拒绝
 */
async function 检查macOS麦克风权限(os: string | undefined): Promise<boolean> {
    if (!isElectron) {
        return true;
    }
    if (os !== "darwin") {
        return true;
    }

    const status = await ipcInvoke<string>(Constants.SIYUAN_GET, { cmd: "getMicrophone" });
    // macOS 麦克风权限被拒绝、受限或未知状态时，提示用户
    if (["denied", "restricted", "unknown"].includes(status)) {
        showMessage(siyuanI18n.microphoneDenied);
        return false;
    }

    if (status !== "not-determined") {
        return true;
    }

    const isAccess = await ipcInvoke<boolean>(Constants.SIYUAN_GET, { cmd: "askMicrophone" });
    if (!isAccess) {
        showMessage(siyuanI18n.microphoneNotAccess);
        return false;
    }
    return true;
}

/**
 * 请求麦克风权限并创建新的录音器实例
 *
 * 作用：通过 getUserMedia 获取音频流，创建 RecordMedia 实例，经 setMediaRecorder 保存实例后
 *   交由 startRecord 开始录音（startRecord 内部调用新的 AudioWorklet startRecording）
 * 意图：将录音器初始化逻辑从菜单点击回调中抽离，保持 添加录音菜单项 的 click 回调简洁
 * 调用时机：在 添加录音菜单项 的 click 回调中，当 mediaRecorder 不存在（首次录音）时调用
 */
function 初始化新录音器(
    protyle: IProtyle,
    setMediaRecorder: 录音器上下文["setMediaRecorder"],
    startRecord: 录音器上下文["startRecord"]
): void {
    // @内联回调
    const audioConstraints = (isInAndroid() || isInHarmony()) ? {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
    } : true;
    navigator.mediaDevices.getUserMedia({ audio: audioConstraints }).then((mediaStream: MediaStream) => {
        const newRecorder = new RecordMedia(mediaStream);
        setMediaRecorder(newRecorder);
        startRecord(protyle);
    }).catch((error: unknown) => {
        if (error instanceof RecordMediaInputEndedError) {
            showMessage(siyuanI18n.recordInterrupted);
            return;
        }
        const isSilentNotAllowed = (isInAndroid() || isInHarmony()) && error instanceof DOMException && error.name === "NotAllowedError";
        if (isSilentNotAllowed) {
            return;
        }
        showMessage(siyuanI18n["record-tip"]);
    });
}

/**
 * 停止当前录音并将录音文件上传到文档
 *
 * 作用：停止 RecordMedia 录音，隐藏录音提示消息，将录音数据构建为 MP3 文件并通过 uploadFiles 上传
 * 意图：封装"停止录音 → 构建文件 → 上传"的完整流程，避免在菜单点击回调中堆积逻辑
 * 调用时机：在 添加录音菜单项 的 click 回调中，当 mediaRecorder 正在录音时调用
 */
async function 停止录音并上传(protyle: IProtyle, mediaRecorder: RecordMedia, messageId: string): Promise<void> {
    hideMessage(messageId);
    try {
        const blob = await mediaRecorder.stopRecording();
        const file = new File([blob], `record${Date.now()}.mp3`, { type: "audio/mpeg" });
        uploadFiles(protyle, [file]);
    } catch (error) {
        showMessage(error instanceof RecordMediaInputEndedError ? siyuanI18n.recordInterrupted : siyuanI18n["record-tip"]);
    }
}

/**
 * 向面包屑菜单添加"开始/停止录音"菜单项
 *
 * 作用：根据当前录音状态创建对应的录音菜单项（开始录音 / 结束录音），
 *   点击后检查麦克风权限，然后执行录音初始化、开始或停止操作
 * 意图：将录音菜单项的构建逻辑从 showBreadcrumbMenu 中解耦，保持单一职责
 * 调用时机：由 menuItems.misc.ts 的 添加上传与录音组 在构建面包屑右键菜单时调用
 *
 * @同步豁免: UI构建 - 函数职责是同步构建 MenuItem DOM 元素并 append 到菜单，
 *   调用方 添加上传与录音组 按顺序同步组装菜单，无法使用异步；
 *   内部的异步逻辑（权限检查）已委托给 click 回调处理
 */
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
        /** 录音菜单项点击回调：检查麦克风权限后，根据录音状态执行初始化/开始/停止录音操作 */
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
                void 停止录音并上传(protyle, mediaRecorder, messageId);
                return;
            }

            hideMessage(messageId);
            startRecord(protyle);
        }
    }).element);
}
