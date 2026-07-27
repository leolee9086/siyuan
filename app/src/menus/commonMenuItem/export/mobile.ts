/** 用途：读取导出协议常量；使用范围：移动打印；解耦评估：本域网关直达稳定声明。 */
import {Constants} from "./imports";
/** 用途：请求预览 HTML；使用范围：PDF 点击；解耦评估：本域网关保持回调协议。 */
import {fetchPost} from "./imports";
/** 用途：读取 host；使用范围：HTML 基址；解耦评估：本域网关直达环境查询。 */
import {getLocationHost} from "./imports";
/** 用途：读取 protocol；使用范围：HTML 基址；解耦评估：本域网关直达环境查询。 */
import {getLocationProtocol} from "./imports";
/** 用途：读取菜单文案；使用范围：菜单和进度；解耦评估：本域网关保持严格读取。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：读取 PDF 参数；使用范围：预览请求；解耦评估：本域网关保持严格读取。 */
import {getSiyuanStorage} from "./imports";
/** 用途：调用 Android 打印；使用范围：原生分支；解耦评估：本域网关直达环境桥。 */
import {getWindowJSAndroid} from "./imports";
/** 用途：调用 Harmony 打印；使用范围：原生分支；解耦评估：本域网关直达环境桥。 */
import {getWindowJSHarmony} from "./imports";
/** 用途：调用 iOS 打印；使用范围：原生分支；解耦评估：本域网关直达环境桥。 */
import {getWindowWebkit} from "./imports";
/** 用途：隐藏进度消息；使用范围：打印延迟结束；解耦评估：本域网关保持消息身份。 */
import {hideMessage} from "./imports";
/** 用途：选择 Android；使用范围：打印桥选择；解耦评估：平台事实不由调用方注入。 */
import {isInAndroid} from "./imports";
/** 用途：选择 Harmony；使用范围：打印桥选择；解耦评估：平台事实不由调用方注入。 */
import {isInHarmony} from "./imports";
/** 用途：选择 iOS；使用范围：打印桥选择；解耦评估：平台事实不由调用方注入。 */
import {isInIOS} from "./imports";
/** 用途：控制打印项可见性；使用范围：移动菜单；解耦评估：平台事实不由调用方注入。 */
import {isInMobileApp} from "./imports";
/** 用途：生成打印 HTML；使用范围：PDF 回调；解耦评估：本域网关直达导出实现。 */
import {onExport} from "./imports";
/** 用途：保存 HTML；使用范围：两个 HTML 项；解耦评估：本域网关直达导出实现。 */
import {saveExport} from "./imports";
/** 用途：显示进度消息；使用范围：PDF 点击；解耦评估：本域网关保持同步身份。 */
import {showMessage} from "./imports";

/** 将生成的 PDF HTML 发送给唯一匹配的原生打印桥。 */
const printMobilePDF = (name: string, html: string) => {
    const print = isInAndroid()
        ? () => getWindowJSAndroid().print(name, html)
        : isInHarmony()
            ? () => getWindowJSHarmony().print(name, html)
            : isInIOS()
                ? () => getWindowWebkit().messageHandlers.print.postMessage(name + Constants.ZWSP + html)
                : undefined;
    print?.();
};

/** 完成移动 PDF HTML 生成、原生打印，并保持原三秒进度隐藏时序。 */
const handleMobilePDFExport = async (response: IWebSocketData, id: string, msgId: string | undefined) => {
    const servePath = getLocationProtocol() + "//" + getLocationHost() + "/";
    const html = await onExport(response, undefined, servePath, {type: "pdf", id});
    if (typeof html !== "string") {
        throw new Error("移动 PDF 导出未生成 HTML");
    }
    printMobilePDF(response.data.name, html);
    // 既有交互要求打印桥调用后保留三秒“导出中”提示，原生桥没有完成事件可监听。
    setTimeout(() => {
        void hideMessage(msgId);
    }, 3000);
};

/** 创建非 Electron 平台的打印与 HTML 导出项。 @同步豁免: UI构建 - 菜单必须同步组装。 @显式返回类型原因: 固定 IMenu 协议字面量供顶层 submenu 组合。 */
export const createMobileExportMenuItems = (id: string): IMenu[] => [{
    id: "exportPDF",
    label: getSiyuanLanguages().print,
    icon: "iconPDF",
    ignore: !isInMobileApp(),
    /** 请求预览 HTML 后执行移动打印。 */
    click: () => {
        const msgId = showMessage(getSiyuanLanguages().exporting);
        const localData = getSiyuanStorage()[Constants.LOCAL_EXPORTPDF];
        fetchPost("/api/export/exportPreviewHTML", {
            id,
            keepFold: localData.keepFold,
            merge: localData.mergeSubdocs,
        }, response => {
            void handleMobilePDFExport(response, id, msgId);
        });
    }
}, {
    id: "exportHTML_SiYuan",
    label: "HTML (SiYuan)",
    iconClass: "ft__error",
    icon: "iconHTML5",
    /** 交给现有 SiYuan HTML 保存流程。 */
    click: () => saveExport({type: "html", id})
}, {
    id: "exportHTML_Markdown",
    label: "HTML (Markdown)",
    icon: "iconHTML5",
    /** 交给现有 Markdown HTML 保存流程。 */
    click: () => saveExport({type: "htmlmd", id})
}];
