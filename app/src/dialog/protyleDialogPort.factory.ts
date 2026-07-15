/**
 * 完整思源对 Protyle Dialog Port 的适配器。
 *
 * 该文件是唯一允许把 Protyle 的宿主弹窗契约连接到原版 Dialog 实现的
 * 边界。Protyle 本身只导入 `protyle/runtime/dialog.port`。
 */
import {Dialog} from "./index";
import {confirmDialog} from "./confirmDialog";
import {hideMessage, showMessage} from "./message";
import {hideTooltip, showTooltip} from "./tooltip";
import {openAssetDialog, closeAssetDialog} from "../asset/assetDialog";
import {moveResize} from "./moveResize";
import {setProtyleDialogPort} from "../protyle/runtime/dialog.port";
import type {IProtyleDialogPort} from "../protyle/runtime/dialog.types";

/** 将公共创建参数交给完整 App 的原版 Dialog，保留插件可见的真实实例。 */
const createDialog = (options: Parameters<IProtyleDialogPort["create"]>[0]) => new Dialog(options);

/** 将确认请求转发到原版确认框；回调适配保持原版 Dialog 类型和插件行为。 */
/** @参数豁免: 第三方接口适配 */
// @柯里化
const confirmInApp = (title: string, text: string, confirm?: Parameters<IProtyleDialogPort["confirm"]>[2], cancel?: Parameters<IProtyleDialogPort["confirm"]>[3], isDelete?: boolean) => confirmDialog(
    title,
    text,
    dialog => confirm?.(dialog),
    dialog => cancel?.(dialog),
    isDelete,
);

/** 将消息请求转发到原版消息容器，保留其异步消息 ID。 */
/** @参数豁免: 第三方接口适配 */
// @柯里化
const showMessageInApp = (message: string, timeout?: number, type?: string, messageId?: string) => showMessage(message, timeout, type, messageId);

/** 将消息关闭请求转发到原版消息容器，并解析异步消息 ID。 */
const hideMessageInApp = (id: Parameters<IProtyleDialogPort["hideMessage"]>[0]) => Promise.resolve(id).then(resolvedId => hideMessage(resolvedId));

/** 将 Tooltip 请求交给完整 App 的定位实现。 */
/** @参数豁免: 第三方接口适配 */
// @柯里化
const showTooltipInApp = (message: string, target: Element, tooltipClass?: string, event?: MouseEvent, space?: number) => showTooltip(message, target, tooltipClass, event, space);

/** 将 Tooltip 关闭请求交给完整 App。 */
// @柯里化
const hideTooltipInApp = () => hideTooltip();

const port: IProtyleDialogPort = {
    create: createDialog,
    confirm: confirmInApp,
    showMessage: showMessageInApp,
    hideMessage: hideMessageInApp,
    showTooltip: showTooltipInApp,
    hideTooltip: hideTooltipInApp,
    openAssetDialog,
    closeAssetDialog,
    moveResize,
};

/** 在主 App 创建 Protyle 之前注册原版 UI 实现。该函数幂等且不会修改插件 API。 */
export const registerProtyleDialogPort = () => {
    setProtyleDialogPort(port);
    return port;
};

/** 返回完整 App 已注册的 Dialog Port，供诊断和宿主扩展使用。 */
export const getProtyleDialogPort = () => port;
