/**
 * Gutter 块菜单 - 数据库视窗 菜单构建模块
 * 从 renderMenu 提取的菜单构建逻辑
 */

/**
 * 用途：国际化文本获取
 * 使用范围：菜单标签显示
 * 解耦评估：通过 imports.ts 统一管理
 */
import { siyuanI18n } from "./imports";
/**
 * 用途：后端 API 调用
 * 使用范围：导出数据库视图
 * 解耦评估：通过 imports.ts 统一管理
 */
import { fetchPost } from "./imports";
/**
 * 用途：移动端文件打开
 * 使用范围：导出结果打开
 * 解耦评估：通过 imports.ts 统一管理
 */
import { saveExportFile } from "./imports";
/**
 * 用途：系统 Shell 操作
 * 使用范围：在文件夹中显示数据库文件
 * 解耦评估：通过 imports.ts 统一管理
 */
import { useShell } from "./imports";
import {isEncryptedBox} from "../../util/file/notebook/store";
/**
 * 用途：获取系统配置
 * 使用范围：获取数据目录路径
 * 解耦评估：通过 imports.ts 统一管理
 */
import { getSiyuanConfig } from "./imports";
/**
 * 用途：路径处理
 * 使用范围：构建数据库文件路径
 * 解耦评估：通过 imports.ts 统一管理
 */
import { originalPath } from "./imports";

/**
 * 构建 AV (Attribute View) 相关菜单
 *
 * 作用：为数据库视图块生成导出和文件夹操作相关的菜单项
 * 意图：提供数据库视图的导出CSV和在文件夹中显示的快捷操作
 * 调用时机：在 gutter 菜单渲染时，当检测到节点是数据库视图类型时调用
 *
 * @param nodeElement - 数据库视图的 DOM 元素，用于获取 data-av-id 属性
 * @param id - 块 ID，用于导出操作
 * @returns 菜单项配置数组
 */
export const buildGutterAvMenu = async (nodeElement: Element, id: string) => {
    const menus: IMenu[] = [];

    menus.push({ id: "separator_exportCSV", type: "separator" });
    menus.push({
        id: "exportCSV",
        icon: "iconDatabase",
        label: siyuanI18n.export + " CSV",
        /**
         * 导出数据库视图为 CSV 文件
         *
         * 作用：调用后端 API 导出当前数据库视图的数据为 CSV 格式
         * 意图：让用户能够将数据库视图数据导出到外部使用
         * 调用时机：用户点击"导出 CSV"菜单项时
         */
        click() {
            fetchPost("/api/export/exportAttributeView", {
                id: nodeElement.getAttribute("data-av-id"),
                blockID: id,
            }, response => {
                saveExportFile(response.data.zip);
            });
        }
    });

    menus.push({
        id: "showDatabaseInFolder",
        icon: "iconFolder",
        label: siyuanI18n.showInFolder,
        /**
         * 在文件管理器中显示数据库文件
         *
         * 作用：打开系统文件管理器并定位到数据库视图的 JSON 存储文件
         * 意图：方便用户直接访问数据库视图的底层存储文件
         * 调用时机：用户点击"在文件夹中显示"菜单项时
         */
        click() {
            const config = getSiyuanConfig();
            const avRoot = isEncryptedBox(protyle.notebookId)
                ? originalPath().join(config.system.dataDir, protyle.notebookId, "storage", "av")
                : originalPath().join(config.system.dataDir, "storage", "av");
            useShell("showItemInFolder", originalPath().join(avRoot, nodeElement.getAttribute("data-av-id") || "") + ".json");
        }
    });

    return menus;
};
