/** 用途：读取导出文案；使用范围：顶层菜单；解耦评估：本域网关保持严格环境读取。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：选择平台菜单组；使用范围：顶层菜单；解耦评估：构建期事实不由调用方注入。 */
import {isElectron} from "./imports";
/** 用途：构建菜单 DOM；使用范围：本 factory；解耦评估：菜单领域唯一实现。 */
import {MenuItem} from "./imports";
/** 用途：组装基础菜单项；使用范围：顶层菜单；解耦评估：同域真实所有者直接引用。 */
import {createBaseExportMenuItems} from "./menuItems";
/** 用途：组装桌面菜单项；使用范围：桌面分支；解耦评估：同域真实所有者直接引用。 */
import {createElectronExportMenuItems} from "./menuItems";
/** 用途：组装非桌面菜单项；使用范围：平台分支；解耦评估：同域真实所有者直接引用。 */
import {createMobileExportMenuItems} from "./mobile";
/** 用途：组装更多格式；使用范围：桌面分支；解耦评估：同域真实所有者直接引用。 */
import {createMoreFormatsMenuItem} from "./moreFormats";
/** 用途：组装模板动作；使用范围：首个菜单项；解耦评估：同域 factory 直接引用。 */
import {createTemplateExportMenuItem} from "./template.factory";

/** 创建当前平台的完整文档导出菜单。 @同步豁免: UI构建 - 调用方必须同步 append 菜单 DOM。 */
export const exportMd = (id: string) => {
    if (window.siyuan.isPublish) {
        return;
    }
    const platformItems = isElectron
        ? [...createElectronExportMenuItems(id), createMoreFormatsMenuItem(id)]
        : createMobileExportMenuItems(id);
    return new MenuItem({
        id: "export",
        label: getSiyuanLanguages().export,
        type: "submenu",
        icon: "iconUpload",
        submenu: [
            createTemplateExportMenuItem(id),
            ...createBaseExportMenuItems(id),
            ...platformItems,
        ],
    }).element;
};
