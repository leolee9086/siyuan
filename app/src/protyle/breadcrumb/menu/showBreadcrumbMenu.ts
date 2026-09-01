/**
 * 面包屑菜单显示逻辑
 * 从 Breadcrumb 类中提取的 showMenu 方法核心逻辑
 */
/*
 * 用途：发送异步POST请求到后端API获取文档树统计信息
 * 使用范围：显示面包屑菜单时调用/api/block/getTreeStat接口
 * 解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { fetchPost } from "./imports";
/*
 * 用途：判断当前是否为移动端环境
 * 使用范围：决定菜单显示方式（全屏或popup）
 * 解耦评估：平台检测函数，可通过依赖注入解耦，但作为全局平台判断直接导入更合理
 */
import { isMobile } from "./imports";
/*
 * 用途：提供全局常量配置
 * 使用范围：使用MENU_BREADCRUMB_MORE常量标识菜单类型
 * 解耦评估：全局配置，可通过配置注入解耦，但作为全局常量直接导入更合理
 */
import { Constants } from "./imports";
/*
 * 用途：查找最近的块级元素
 * 使用范围：获取当前光标所在块的ID
 * 解耦评估：DOM工具函数，可通过参数传递解耦，但作为protyle核心工具直接导入更合理
 */
import { hasClosestBlock } from "./imports";
/*
 * 用途：查找最近的指定类名的祖先元素
 * 使用范围：判断菜单是否在popover中以设置data-from属性
 * 解耦评估：DOM工具函数，可通过参数传递解耦，但作为protyle核心工具直接导入更合理
 */
import { hasTopClosestByClassName } from "./imports";
/*
 * 用途：获取编辑器当前选区范围
 * 使用范围：获取光标位置以确定当前块ID
 * 解耦评估：编辑器工具函数，可通过参数传递解耦，但作为protyle核心工具直接导入更合理
 */
import { getEditorRange } from "./imports";
/*
 * 用途：触发插件菜单打开事件
 * 使用范围：通知插件系统在面包屑菜单中添加自定义菜单项
 * 解耦评估：事件发射函数，已经是解耦的事件机制实现，直接导入合理
 */
import { emitOpenMenu } from "./imports";
/*
 * 用途：获取思源全局配置
 * 使用范围：传递给菜单项辅助函数以获取快捷键配置
 * 解耦评估：全局配置访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { getSiyuanConfig } from "./imports";
/*
 * 用途：获取思源菜单系统实例
 * 使用范围：获取全局Menu实例用于显示和构建面包屑菜单
 * 解耦评估：全局菜单系统访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { getSiyuanMenus } from "./imports";
/*
 * 用途：菜单类，用于创建和管理菜单容器
 * 使用范围：类型标注，标识menu参数类型
 * 解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
 */
import { Menu } from "./imports";
/*
 * 用途：录音器上下文类型定义
 * 使用范围：类型标注，标识录音上下文参数类型
 * 解耦评估：类型定义，无需解耦
 */
import type { 录音器上下文 } from "./imports";
/*
 * 用途：添加资源转换相关菜单项（网络图片转本地、网络资源转本地、上传CDN、分享到链滴）
 * 使用范围：构建面包屑菜单时在非只读状态下调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加资源转换菜单项 } from "./menuItems";
/*
 * 用途：添加导出预览菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加导出预览菜单项 } from "./menuItems";
/*
 * 用途：添加只读模式子菜单（启用/禁用）
 * 使用范围：构建面包屑菜单时在非全局只读且wysiwyg存在时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加只读模式菜单项 } from "./menuItems";
/*
 * 用途：添加全宽模式子菜单（启用/禁用/默认）
 * 使用范围：构建面包屑菜单时在桌面端非只读且wysiwyg存在时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加全宽模式菜单项, 添加标题序号菜单项 } from "./menuItems";
/*
 * 用途：添加懒加载菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加懒加载菜单项 } from "./menuItems.misc";
/*
 * 用途：添加刷新菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加刷新菜单项 } from "./menuItems.misc";
/*
 * 用途：添加优化排版菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加优化排版菜单项 } from "./menuItems.misc";
/*
 * 用途：添加全屏菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加全屏菜单项 } from "./menuItems.misc";
/*
 * 用途：添加文档信息菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加文档信息菜单项 } from "./menuItems.misc";
/*
 * 用途：添加上传与录音组菜单项
 * 使用范围：构建面包屑菜单时调用
 * 解耦评估：菜单项构建函数，可通过参数传递解耦，但作为模块内部函数直接导入更合理
 */
import { 添加上传与录音组 } from "./menuItems.misc";

/**
 * 显示面包屑"更多"菜单
 * @param protyle 编辑器实例
 * @param position 菜单位置
 * @param 录音上下文 录音相关的上下文对象
 * @同步豁免: UI构建 - 需要立即响应用户点击事件显示菜单，内部异步操作通过回调处理
 */
export function 显示面包屑菜单(
    protyle: IProtyle,
    position: IPosition,
    录音上下文: 录音器上下文
) {
    const menus = getSiyuanMenus();
    if (!menus) {
        return;
    }
    const menu = menus.menu;

    // 如果菜单已显示且是面包屑菜单，则关闭
    if (!menu.element.classList.contains("fn__none") &&
        menu.element.getAttribute("data-name") === Constants.MENU_BREADCRUMB_MORE) {
        menu.remove();
        return;
    }

    // 获取当前光标所在块的 ID
    let id: string | undefined;
    const cursorNodeElement = hasClosestBlock(getEditorRange(protyle.element).startContainer);
    if (cursorNodeElement) {
        id = cursorNodeElement.getAttribute("data-node-id") ?? undefined;
    }

    const blockId = id || (protyle.block.showAll ? protyle.block.id : protyle.block.rootID);

    fetchPost("/api/block/getTreeStat", { id: blockId }, (response) => {
        构建菜单内容(protyle, position, response, 录音上下文);
    });
}

/**
 * 构建菜单内容（fetchPost 回调）
 * @参数豁免: 遗留代码
 */
function 构建菜单内容(
    protyle: IProtyle,
    position: IPosition,
    response: IWebSocketData,
    录音上下文: 录音器上下文
) {
    const menus = getSiyuanMenus();
    if (!menus) {
        return;
    }
    const menu = menus.menu;
    const siyuanConfig = getSiyuanConfig();

    if (!response.data || !response.data.stat) {
        return;
    }

    menu.remove();
    menu.element.setAttribute("data-name", Constants.MENU_BREADCRUMB_MORE);

    // 上传和录音菜单项
    添加上传与录音组(protyle, menu, 录音上下文);

    // 资源转换菜单项
    if (!protyle.disabled) {
        添加资源转换菜单项(protyle, menu, siyuanConfig);
    }

    // 懒加载选项
    添加懒加载菜单项(protyle, menu);

    // 刷新菜单项（含分隔符）
    添加刷新菜单项(protyle, menu);

    // 优化排版
    添加优化排版菜单项(protyle, menu);

    // 全屏
    添加全屏菜单项(protyle, menu);

    // 打开导出预览页签
    添加导出预览菜单项(protyle, menu, siyuanConfig);

    // 只读模式子菜单
    if (!siyuanConfig.editor.readOnly && !siyuanConfig.readonly && protyle.wysiwyg) {
        添加只读模式菜单项(protyle, menu);
    }

    // 全宽模式子菜单
    if (!isMobile && !protyle.disabled && protyle.wysiwyg) {
        添加全宽模式菜单项(protyle, menu);
    }

    // 标题自动编号子菜单（上游 86953fbcfb）：per-document 覆盖，置于全宽之后、插件之前
    if (!isMobile && protyle.wysiwyg) {
        添加标题序号菜单项(protyle, menu);
    }

    // 插件菜单
    if (protyle.app?.plugins) {
        emitOpenMenu({
            plugins: protyle.app.plugins,
            type: "open-menu-breadcrumbmore",
            detail: {
                protyle,
                data: response.data.stat,
            },
            separatorPosition: "top",
        });
    }

    // 文档信息
    添加文档信息菜单项(menu, response);

    // 显示菜单并设置来源属性
    显示并标记菜单来源(menu, protyle, position);
}

/**
 * 显示菜单并标记其来源（app 或 popover）
 * @param menu 菜单实例
 * @param protyle 编辑器实例，用于判断 popover 层级
 * @param position 桌面端菜单弹出位置
 */
function 显示并标记菜单来源(menu: InstanceType<typeof Menu>, protyle: IProtyle, position: IPosition) {
    if (isMobile) {
        menu.fullscreen();
    }
    if (!isMobile) {
        menu.popup(position);
    }
    const popoverElement = hasTopClosestByClassName(protyle.element, "block__popover", true);
    menu.element.setAttribute("data-from", popoverElement ? popoverElement.dataset.level + "popover" : "app");
}
