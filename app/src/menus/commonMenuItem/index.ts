/**
 * 用途：全局常量定义
 * 使用范围：renameMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { Constants } from "./imports";
/**
 * 用途：发送异步 POST 请求
 * 使用范围：openAttr、renameMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { fetchPost } from "./imports";
/**
 * 用途：获取思源配置
 * 使用范围：renameMenu 和 movePathToMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：检测 Electron 环境
 * 使用范围：exportMd 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { isElectron } from "./imports";
/**
 * 用途：菜单项类
 * 使用范围：exportMd、renameMenu、movePathToMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { MenuItem } from "./imports";
/**
 * 用途：移动文件路径
 * 使用范围：movePathToMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { movePathTo } from "./imports";
/**
 * 用途：移动文件到指定路径
 * 使用范围：movePathToMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { moveToPath } from "./imports";
/**
 * 用途：POSIX 路径处理
 * 使用范围：movePathToMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { pathPosix } from "./imports";
/**
 * 用途：执行重命名操作
 * 使用范围：renameMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { rename } from "./imports";
/**
 * 用途：国际化文本
 * 使用范围：exportMd、renameMenu、movePathToMenu 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：获取发布模式状态
 * 使用范围：exportMd 函数
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getSiyuanIsPublish } from "./imports";
/**
 * 用途：打开文件属性对话框
 * 使用范围：openAttr 函数
 * 解耦评估：已提取到独立文件
 */
import {openFileAttr} from "./fileAttr/openFileAttr";
/**
 * 用途：创建模板导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createTemplateExportMenuItem } from "./export/template";
/**
 * 用途：创建 SiYuan 格式导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createSiYuanZipExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建 Markdown 导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createMarkdownZipExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建图片导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createImageExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建 PDF 导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createPDFExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建 HTML (SiYuan) 导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createHTMLSiYuanExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建 HTML (Markdown) 导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createHTMLMarkdownExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建 Word 导出菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createWordExportMenuItem } from "./export/menuItems";
/**
 * 用途：创建更多导出格式菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createMoreFormatsMenuItem } from "./export/moreFormats";
/**
 * 用途：创建移动端 PDF 菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createMobilePDFMenuItem } from "./export/mobile";
/**
 * 用途：创建移动端 HTML (SiYuan) 菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createMobileHTMLSiYuanMenuItem } from "./export/mobile";
/**
 * 用途：创建移动端 HTML (Markdown) 菜单项
 * 使用范围：exportMd 函数
 * 解耦评估：已提取到独立文件
 */
import { createMobileHTMLMarkdownMenuItem } from "./export/mobile";
/**
 * 用途：复制子菜单
 * 使用范围：多个菜单模块
 * 解耦评估：已提取到独立文件，此处重新导出以保持 API 兼容性
 */
import { copySubMenu } from "./copy";
/**
 * 用途：打开块属性对话框
 * 作用：获取块属性并显示属性编辑对话框
 * 意图：为用户提供编辑块属性的界面
 * 调用时机：用户点击块的属性菜单项时
 * @同步豁免: UI构建 - 菜单项创建需要同步返回
 */
export const openAttr = (nodeElement: Element, focusName = "bookmark", protyle: IProtyle) => {
    // 判断是否为分隔线块，分隔线块不支持属性编辑
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    fetchPost("/api/attr/getBlockAttrs", { id }, (response) => {
        openFileAttr(response.data, focusName, protyle);
    });
};

/**
 * 用途：创建导出菜单
 * 作用：构建包含多种导出格式的菜单项
 * 意图：为用户提供统一的导出入口
 * 调用时机：在文档或块的右键菜单中显示导出选项时
 * @同步豁免: UI构建 - 菜单项创建需要同步返回 DOM 元素
 */
export const exportMd = (id: string) => {
    // 判断是否为发布模式，发布模式下不显示导出菜单
    if (getSiyuanIsPublish()) {
        return;
    }
    // @内联数组
    const baseMenuItems = [
        createTemplateExportMenuItem(id),
        createSiYuanZipExportMenuItem(id),
        createMarkdownZipExportMenuItem(id),
        createImageExportMenuItem(id),
    ];
    // @内联数组
    const electronMenuItems = isElectron ? [
        createPDFExportMenuItem(id),
        createHTMLSiYuanExportMenuItem(id),
        createHTMLMarkdownExportMenuItem(id),
        createWordExportMenuItem(id),
        createMoreFormatsMenuItem(id),
    ] : [];
    // @内联数组
    const mobileMenuItems = !isElectron ? [
        createMobilePDFMenuItem(id),
        createMobileHTMLSiYuanMenuItem(id),
        createMobileHTMLMarkdownMenuItem(id),
    ] : [];
    
    return new MenuItem({
        id: "export",
        label: siyuanI18n.export,
        type: "submenu",
        icon: "iconUpload",
        submenu: [...baseMenuItems, ...electronMenuItems, ...mobileMenuItems]
    }).element;
};

/**
 * 用途：创建重命名菜单项
 * 作用：构建文件或笔记本的重命名菜单项
 * 意图：为用户提供重命名功能入口
 * 调用时机：在文件或笔记本的右键菜单中显示重命名选项时
 * @同步豁免: UI构建 - 菜单项创建需要同步返回 DOM 元素
 */
export const renameMenu = (options: {
    path: string
    notebookId: string
    name: string,
    type: "notebook" | "file"
    docId?: string | null
}) => {
    return new MenuItem({
        id: "rename",
        accelerator: getSiyuanConfig().keymap.editor.general.rename.custom,
        icon: "iconEdit",
        label: siyuanI18n.rename,
        /**
         * 用途：触发重命名操作
         * 意图：根据类型获取文档信息或直接重命名
         * 调用时机：用户点击重命名菜单项时
         */
        click: () => {
            // 判断是否为文件类型且有文档 ID，需要先获取文档信息
            if (options.type !== "file" || !options.docId) {
                rename(options);
                return;
            }
            // @内联回调
            fetchPost("/api/block/getDocInfo", {
                id: options.docId
            }, (response) => {
                rename({
                    ...options,
                    name: response.data.ial.title,
                    empty: response.data.ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true",
                });
            });
        }
    }).element;
};

/**
 * 用途：导出复制子菜单函数
 * 作用：保持 API 兼容性，供其他模块使用
 * 意图：避免破坏现有导入路径
 */
export { copySubMenu };

/**
 * 用途：创建移动路径菜单项
 * 作用：构建文件移动功能的菜单项
 * 意图：为用户提供文件移动功能入口
 * 调用时机：在文件的右键菜单中显示移动选项时
 * @同步豁免: UI构建 - 菜单项创建需要同步返回 DOM 元素
 */
export const movePathToMenu = (paths: string[]) => {
    return new MenuItem({
        id: "move",
        label: siyuanI18n.move,
        icon: "iconMove",
        accelerator: getSiyuanConfig().keymap.general.move.custom,
        /**
         * 用途：触发移动路径对话框
         * 意图：打开文件移动选择器
         * 调用时机：用户点击移动菜单项时
         */
        click() {
            const rootIDs: string[] = [];
            for (const item of paths) {
                rootIDs.push(pathPosix().basename(item).replace(".sy", ""));
            }
            
            movePathTo({
                /**
                 * 用途：移动完成后的回调
                 * 意图：执行实际的文件移动操作
                 * 调用时机：用户选择目标路径后
                 */
                cb: (toPath, toNotebook) => {
                    const toPathStr = toPath[0] ;
                    const toNotebookStr = toNotebook[0] ;
                    if(!toPathStr || !toNotebookStr) {
                        return;
                    }
                    moveToPath(paths, toNotebookStr, toPathStr);
                },
                paths,
                flashcard: false,
                rootIDs,
            });
        }
    }).element;
};
