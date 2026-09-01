/**
 * 面包屑菜单项辅助函数
 * 从 showBreadcrumbMenu.ts 提取的菜单项创建函数
 */
/*
 * 用途：发送异步 POST 请求到后端 API
 * 使用范围：资源转换、上传CDN、分享到链滴、只读模式、全宽模式等菜单项的后端交互
 * 解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { fetchPost } from "./imports";
/*
 * 用途：提供全局常量配置
 * 使用范围：只读模式和全宽模式菜单项中使用自定义属性常量
 * 解耦评估：全局配置，可通过配置注入解耦，但作为全局常量直接导入更合理
 */
import { Constants } from "./imports";
/*
 * 用途：菜单类，用于创建和管理菜单容器
 * 使用范围：所有菜单项辅助函数的参数类型和菜单项追加操作
 * 解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
 */
import { Menu } from "./imports";
/*
 * 用途：菜单项类，用于创建菜单项
 * 使用范围：所有菜单项辅助函数中创建具体的菜单项实例
 * 解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
 */
import { MenuItem } from "./imports";
/*
 * 用途：将网络资源转换为本地资源
 * 使用范围：资源转换菜单项中执行网络图片和网络资源的本地化操作
 * 解耦评估：业务逻辑函数，可通过参数传递解耦，但作为protyle核心功能直接导入更合理
 */
import { net2LocalAssets } from "./imports";
/*
 * 用途：检查用户是否需要订阅（未订阅会弹出订阅提示）
 * 使用范围：上传资源到CDN菜单项中，在执行上传前检查订阅状态
 * 解耦评估：订阅状态检查是平台级功能，可通过依赖注入或事件机制解耦，
 * 但作为全局权限检查直接导入更合理
 */
import { needSubscribe } from "./imports";
/*
 * 用途：显示确认对话框
 * 使用范围：上传资源到CDN和分享到链滴菜单项中，在执行敏感操作前请求用户确认
 * 解耦评估：UI操作函数，可通过事件机制解耦，但作为全局UI基础设施直接导入更合理
 */
import { confirmDialog } from "./imports";
/*
 * 用途：获取云服务 URL
 * 使用范围：分享到链滴菜单项中构建确认提示信息
 * 解耦评估：配置访问函数，可通过依赖注入解耦，但作为全局配置直接导入更合理
 */
import { getCloudURL } from "./imports";
/*
 * 用途：获取国际化文本
 * 使用范围：所有菜单项的标签和提示信息本地化
 * 解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { siyuanI18n } from "./imports";
/*
 * 用途：统一打开导出预览页签
 * 使用范围：面包屑菜单项中打开预览页签
 * 解耦评估：将预览页签的复用与类型切换收敛到单点，优于散落的 openFile 调用
 */
import { openExportPreviewTab } from "../../../export-preview/open";
/*
 * 用途：获取思源全局配置
 * 使用范围：菜单项辅助函数中获取快捷键配置
 * 解耦评估：全局配置访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { getSiyuanConfig } from "./imports";
/*
 * 用途：检查是否有思源用户登录
 * 使用范围：分享到链滴菜单项中判断是否显示该选项
 * 解耦评估：用户状态检查函数，可通过依赖注入解耦，但作为全局用户状态直接导入更合理
 */
import { hasSiyuanUser } from "./imports";

// ==================== 菜单项辅助函数 ====================

/**
 * 作用：向面包屑菜单追加"网络图片转本地""网络资源转本地""上传资源到CDN""分享到链滴"四组资源管理菜单项
 * 意图：将资源转换/上传/分享操作集中在面包屑菜单中，方便用户对当前文档的资源进行批量操作
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在文档非只读状态下调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
export function 添加资源转换菜单项(
    protyle: IProtyle,
    menu: Menu,
    siyuanConfig: ReturnType<typeof getSiyuanConfig>
): void {
    menu.append(new MenuItem({
        id: "netImg2LocalAsset",
        label: siyuanI18n.netImg2LocalAsset,
        icon: "iconImgDown",
        accelerator: siyuanConfig.keymap.editor.general.netImg2LocalAsset.custom,
        /** 作用：将文档中的网络图片下载为本地资源 | 调用时机：用户点击菜单项时 */
        click() {
            net2LocalAssets(protyle, "Img");
        }
    }).element);

    menu.append(new MenuItem({
        id: "netAssets2LocalAssets",
        label: siyuanI18n.netAssets2LocalAssets,
        icon: "iconTransform",
        accelerator: siyuanConfig.keymap.editor.general.netAssets2LocalAssets.custom,
        /** 作用：将文档中的所有网络资源下载为本地资源 | 调用时机：用户点击菜单项时 */
        click() {
            net2LocalAssets(protyle, "Assets");
        }
    }).element);

    menu.append(new MenuItem({
        id: "uploadAssets2CDN",
        label: siyuanI18n.uploadAssets2CDN,
        icon: "iconCloudSucc",
        /** 作用：将文档资源上传到思源CDN | 调用时机：用户点击菜单项时 */
        click() {
            // 未订阅用户会弹出订阅提示，已订阅用户弹出确认对话框后执行上传
            if (!needSubscribe()) {
                confirmDialog("📦 " + siyuanI18n.uploadAssets2CDN, siyuanI18n.uploadAssets2CDNConfirmTip, () => {
                    fetchPost("/api/asset/uploadCloud", { id: protyle.block.id });
                });
            }
        }
    }).element);

    // 分享到链滴（需要登录）
    const user = hasSiyuanUser();
    if (user) {
        menu.append(new MenuItem({
            id: "share2Liandi",
            label: siyuanI18n.share2Liandi,
            icon: "iconLiandi",
            /** 作用：将文档分享到链滴社区 | 调用时机：用户点击菜单项时 */
            click() {
                confirmDialog("🤩 " + siyuanI18n.share2Liandi,
                    siyuanI18n.share2LiandiConfirmTip.replace("${accountServer}", getCloudURL("")), () => {
                        fetchPost("/api/export/export2Liandi", { id: protyle.block.parentID });
                    });
            }
        }).element);
    }
}

/**
 * 作用：在面包屑菜单中添加"打开导出预览"顶级菜单项
 * 意图：preview 已从 protyle 编辑模式剥离为独立页签，此菜单项替代原"编辑模式"子菜单中的"预览"选项
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
export function 添加导出预览菜单项(
    protyle: IProtyle,
    menu: Menu,
    siyuanConfig: ReturnType<typeof getSiyuanConfig>
) {
    const item = new MenuItem({
        id: "openExportPreview",
        icon: "iconPreview",
        label: siyuanI18n.preview,
        accelerator: siyuanConfig.keymap.editor.general.preview.custom,
        /** 作用：打开导出预览页签 | 调用时机：用户点击菜单项时 */
        async click() {
            await openExportPreviewTab({
                app: protyle.app,
                blockId: protyle.block.rootID,
            });
        }
    });
    menu.append(item.element);
}

/**
 * 作用：向面包屑菜单追加"只读模式"子菜单，包含"启用"和"禁用"两个选项
 * 意图：允许用户在面包屑菜单中快速切换当前文档的只读属性
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在非全局只读且 wysiwyg 存在时调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
export function 添加只读模式菜单项(
    protyle: IProtyle,
    menu: Menu
): void {
    const isCustomReadonly = protyle.wysiwyg?.element.getAttribute(Constants.CUSTOM_SY_READONLY);

    menu.append(new MenuItem({
        id: "editReadonly",
        label: siyuanI18n.editReadonly,
        icon: "iconLock",
        type: "submenu",
        submenu: [{
            id: "enable",
            iconHTML: "",
            current: isCustomReadonly === "true",
            label: siyuanI18n.enable,
            /** 作用：将文档只读属性设为 true | 调用时机：用户点击"启用"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_READONLY]: "true" }
                });
            }
        }, {
            id: "disable",
            iconHTML: "",
            current: !isCustomReadonly || isCustomReadonly === "false",
            label: siyuanI18n.disable,
            /** 作用：将文档只读属性设为 false | 调用时机：用户点击"禁用"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_READONLY]: "false" }
                });
            }
        }]
    }).element);
}

/**
 * 作用：向面包屑菜单追加"全宽模式"子菜单，包含"启用""禁用""默认"三个选项
 * 意图：允许用户在面包屑菜单中快速切换当前文档的全宽显示属性
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在桌面端非只读且 wysiwyg 存在时调用
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
export function 添加全宽模式菜单项(
    protyle: IProtyle,
    menu: Menu
): void {
    const isCustomFullWidth = protyle.wysiwyg?.element.getAttribute(Constants.CUSTOM_SY_FULLWIDTH);

    menu.append(new MenuItem({
        id: "fullWidth",
        label: siyuanI18n.fullWidth,
        icon: "iconDock",
        type: "submenu",
        submenu: [{
            id: "enable",
            iconHTML: "",
            current: isCustomFullWidth === "true",
            label: siyuanI18n.enable,
            /** 作用：将文档全宽属性设为 true | 调用时机：用户点击"启用"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "true" }
                });
            }
        }, {
            id: "disable",
            iconHTML: "",
            current: isCustomFullWidth === "false",
            label: siyuanI18n.disable,
            /** 作用：将文档全宽属性设为 false | 调用时机：用户点击"禁用"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "false" }
                });
            }
        }, {
            id: "default",
            iconHTML: "",
            current: !isCustomFullWidth,
            label: siyuanI18n.default,
            /** 作用：清除文档全宽属性，恢复默认行为 | 调用时机：用户点击"默认"时 */
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_FULLWIDTH]: "" }
                });
            }
        }]
    }).element);
}

/**
 * 作用：向面包屑菜单追加"标题自动编号"子菜单，包含"启用""禁用""默认"三个选项
 * 意图：复用上游 86953fbcfb 语义（per-document headingNumber），以本地 headingNumberCore/headingNumber 的 resolve 规则为显示依据，允许用户在面包屑菜单中快速切换当前文档的标题编号属性
 * 调用时机：构建面包屑"更多"菜单时，由 showBreadcrumbMenu.ts 在桌面端 wysiwyg 存在时调用（与上游保持一致：置于全宽之后、插件菜单之前）
 * @同步豁免: UI构建 - 菜单项构建需要同步追加到 Menu DOM
 */
export function 添加标题序号菜单项(
    protyle: IProtyle,
    menu: Menu
): void {
    const isCustomHeadingNumber = protyle.wysiwyg?.element.getAttribute(Constants.CUSTOM_SY_HEADING_NUMBER);

    menu.append(new MenuItem({
        id: "headingNumber",
        label: window.siyuan.languages["headingNumber"] || "Heading number",
        icon: "iconHeadings",
        type: "submenu",
        submenu: [{
            id: "enable",
            iconHTML: "",
            current: isCustomHeadingNumber === "true",
            label: siyuanI18n.enable,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_HEADING_NUMBER]: "true" }
                });
            }
        }, {
            id: "disable",
            iconHTML: "",
            current: isCustomHeadingNumber === "false",
            label: siyuanI18n.disable,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_HEADING_NUMBER]: "false" }
                });
            }
        }, {
            id: "default",
            iconHTML: "",
            current: !isCustomHeadingNumber,
            label: siyuanI18n.default,
            click() {
                fetchPost("/api/attr/setBlockAttrs", {
                    id: protyle.block.rootID,
                    attrs: { [Constants.CUSTOM_SY_HEADING_NUMBER]: "" }
                });
            }
        }]
    }).element);
}
