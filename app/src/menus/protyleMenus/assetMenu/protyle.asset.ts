/**
 * 用途：打开全局资源对话框
 * 使用范围：桌面端 assetMenu 分支
 * 解耦评估：通过 imports.ts 转发，调用方无需感知对话框实现目录
 */
import { openAssetDialog } from "./imports";
/**
 * 用途：构建移动端资源菜单项
 * 使用范围：移动端分支追加 readonly 菜单内容
 * 解耦评估：通过 imports.ts 转发，UI 组件依赖不直接暴露给业务文件
 */
import { MenuItem } from "./imports";
/**
 * 用途：判断是否移动端
 * 使用范围：菜单弹出策略与布局模板分支
 * 解耦评估：通过 imports.ts 转发，平台能力入口统一
 */
import { isMobile } from "./imports";
/**
 * 用途：请求后端搜索与元数据接口
 * 使用范围：renderAssetList 与 更新素材元数据预览
 * 解耦评估：通过 imports.ts 转发，网络调用边界清晰
 */
import { fetchPost } from "./imports";
/**
 * 用途：访问全局菜单单例
 * 使用范围：移动端菜单展示、关闭和追加菜单项
 * 解耦评估：通过 imports.ts 转发，菜单系统细节与业务文件解耦
 */
import { getSiyuanGlobalMenus } from "./imports";
/**
 * 用途：资源项类型约束
 * 使用范围：资源列表渲染、响应数据处理和函数签名
 * 解耦评估：通过 imports.ts 转发类型，避免业务文件直接上跳目录
 */
import type { assetItem } from "./imports";
/**
 * 用途：验证搜索响应数据是否符合 assetItem[] 结构
 * 使用范围：renderAssetList 将后端返回值转换为安全类型
 * 解耦评估：同目录类型守卫模块，保持业务与验证逻辑解耦
 */
import { isAssetItemArray } from "./protyle.asset.guard";
/**
 * 用途：更新资源列表和预览渲染视图
 * 使用范围：搜索响应处理后刷新左侧列表
 * 解耦评估：渲染职责拆分到独立模块，主文件仅负责流程编排
 */
import { 更新资源列表UI } from "./protyle.asset.view";
/**
 * 用途：更新预览区域内容
 * 使用范围：搜索响应处理后刷新右侧预览
 * 解耦评估：渲染职责拆分到独立模块，主文件仅负责流程编排
 */
import { 更新预览区域 } from "./protyle.asset.view";
/**
 * 用途：生成资源菜单模板
 * 使用范围：移动端菜单项 label 模板构建
 * 解耦评估：模板构建独立到视图模块，降低主文件复杂度
 */
import { 生成菜单HTML模板 } from "./protyle.asset.view";
/**
 * 用途：处理资源列表悬停事件
 * 使用范围：mouseover 时更新预览图片和元数据
 * 解耦评估：列表交互逻辑拆分到独立模块，主文件仅做事件装配
 */
import { 处理列表悬停 } from "./protyle.asset.listEvents";
/**
 * 用途：处理资源列表点击事件
 * 使用范围：点击资源项后回调或插入编辑器
 * 解耦评估：列表交互逻辑拆分到独立模块，主文件仅做事件装配
 */
import { 处理列表点击 } from "./protyle.asset.listEvents";
/**
 * 用途：展示扩展名过滤菜单
 * 使用范围：点击 Type 过滤按钮时弹出过滤项
 * 解耦评估：过滤菜单逻辑拆分到独立模块，主文件保持编排职责
 */
import { 显示类型过滤菜单 } from "./protyle.asset.filterMenus";
/**
 * 用途：展示尺寸过滤菜单
 * 使用范围：点击 Size 过滤按钮
 * 解耦评估：过滤菜单逻辑拆分到独立模块，主文件保持编排职责
 */
import { 显示尺寸过滤菜单 } from "./protyle.asset.filterMenus";
/**
 * 用途：展示评分过滤菜单
 * 使用范围：点击 Rating 过滤按钮
 * 解耦评估：过滤菜单逻辑拆分到独立模块，主文件保持编排职责
 */
import { 显示评分过滤菜单 } from "./protyle.asset.filterMenus";
/**
 * 用途：展示颜色过滤菜单
 * 使用范围：点击 Color 过滤按钮
 * 解耦评估：过滤菜单逻辑拆分到独立模块，主文件保持编排职责
 */
import { 显示颜色过滤菜单 } from "./protyle.asset.filterMenus";
/**
 * 用途：创建列表键盘事件处理器
 * 使用范围：输入框 keydown 事件处理上下键/Enter/Escape
 * 解耦评估：输入交互逻辑拆分到独立模块，主文件仅做事件装配
 */
import { 创建键盘事件处理器 } from "./protyle.asset.inputHandlers";
/**
 * 用途：创建输入事件处理器
 * 使用范围：输入框 input 事件触发资源列表刷新
 * 解耦评估：输入交互逻辑拆分到独立模块，主文件仅提供刷新回调
 */
import { 创建输入事件处理器 } from "./protyle.asset.inputHandlers";
/**
 * 用途：创建输入法结束事件处理器
 * 使用范围：输入框 compositionend 事件触发资源列表刷新
 * 解耦评估：输入交互逻辑拆分到独立模块，主文件仅提供刷新回调
 */
import { 创建组合结束处理器 } from "./protyle.asset.inputHandlers";
/** 用途：约束资源菜单公开调用参数；使用范围：桌面与移动入口；解耦评估：调用方仅依赖完整菜单协议。 */
import type {AssetMenuOptions} from "./imports";
/**
 * 用途：构造上一项和下一项按钮复用键盘导航所需的原生事件。
 * 使用范围：资源菜单分页导航按钮。
 * 解耦评估：原生事件构造无跨调用状态，集中到工厂可遵循实例化边界而不引入注册表状态。
 */
import {createAssetMenuArrowKeyEvent} from "./protyle.asset.events.factory";

/** 弹出菜单 */
const 弹出菜单 = (position: IPosition) => {
    // 移动端使用全屏菜单
    if (isMobile) {
        getSiyuanGlobalMenus().menu.fullscreen();
        return;
    }
    // 非移动端使用弹出菜单
    getSiyuanGlobalMenus().menu.popup(position);
};

/** 处理搜索资源的响应 */
const 处理搜索资源响应 = ({element, k, position, data}: {
    element: Element;
    k: string;
    position: IPosition;
    data: assetItem[];
}) => {
    const inputElement = element.querySelector("input");
    const previewElement = element.querySelector("#preview");
    const listElement = element.querySelector(".b3-list");

    if (listElement) {
        更新资源列表UI(listElement, data);
    }
    更新预览区域(previewElement, data);
    弹出菜单(position);

    // 首次打开（无关键词）时自动选中输入框，便于直接输入搜索。
    if (!k && inputElement) {
        inputElement.select();
    }
};

/**
 * 渲染资源列表
 * @作用 根据搜索关键词和扩展名过滤条件，从后端获取资源列表并更新 UI
 * @意图 作为资源选择菜单/对话框的核心渲染入口，统一处理搜索请求和 UI 更新
 * @调用时机
 *   - 菜单/对话框初始化时（k 为空字符串）
 *   - 用户输入搜索关键词时（input 事件）
 *   - 用户修改文件类型过滤条件时
 * @param element - 菜单容器元素
 * @param k - 搜索关键词
 * @param position - 菜单弹出位置
 * @param exts - 文件扩展名过滤列表，如 [".png", ".jpg"]
 * @同步豁免: UI构建 - 该函数用于同步触发搜索并在回调中更新当前菜单 UI，调用方依赖同步返回以维持键盘交互时序。
 */
// @柯里化
export const renderAssetList = ({element, k, position, exts}: {
    element: Element;
    k: string;
    position: IPosition;
    exts: string[];
}) => {
    fetchPost("/api/search/searchAsset", { k, exts }, (response) => {
        const rawData = response.data ?? [];
        const data: assetItem[] = isAssetItemArray(rawData) ? rawData : [];
        处理搜索资源响应({element, k, position, data});
    });
};

/** 绑定过滤按钮下拉菜单事件 */
const 绑定过滤按钮下拉菜单事件 = (
    element: HTMLElement,
    extsRef: { current: string[] },
    刷新过滤后列表: () => void
) => {
    const typeBtn = element.querySelector("[data-type='filter-type']");
    const sizeBtn = element.querySelector("[data-type='filter-size']");
    const ratingBtn = element.querySelector("[data-type='filter-rating']");
    const colorBtn = element.querySelector("[data-type='filter-color']");

    typeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示类型过滤菜单(typeBtn, extsRef, 刷新过滤后列表);
    });
    sizeBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示尺寸过滤菜单(sizeBtn);
    });
    ratingBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示评分过滤菜单(ratingBtn);
    });
    colorBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        显示颜色过滤菜单(colorBtn);
    });
};

/** 绑定菜单元素事件 */
const 绑定菜单元素事件 = ({element, position, protyle, destination, exts}: AssetMenuOptions & {
    element: HTMLElement;
}) => {
    element.style.maxWidth = "none";
    const listElement = element.querySelector(".b3-list");
    const previewElement = element.querySelector("#preview");
    const inputElement = element.querySelector("input");

    if (!listElement || !previewElement || !inputElement) {
        return;
    }

    // 使用引用对象以便在过滤对话框中修改
    const extsRef = { current: exts ?? [] };
    // @柯里化
    /** 当前输入框与过滤条件上下文绑定的刷新函数，用于输入事件和过滤菜单回调复用。 */
    const 刷新过滤后列表 = () => {
        renderAssetList({element, k: inputElement.value, position, exts: extsRef.current});
    };

    listElement.addEventListener("mouseover", 处理列表悬停(previewElement));
    listElement.addEventListener("click", 处理列表点击(destination));
    inputElement.addEventListener("keydown", 创建键盘事件处理器({
        element,
        listElement,
        previewElement,
        protyle,
        destination,
    }));
    inputElement.addEventListener("input", 创建输入事件处理器(刷新过滤后列表));
    inputElement.addEventListener("compositionend", 创建组合结束处理器(刷新过滤后列表));
    绑定过滤按钮下拉菜单事件(element, extsRef, 刷新过滤后列表);

    // 上一个/下一个按钮
    const prevBtn = element.querySelector("[data-type='previous']");
    const nextBtn = element.querySelector("[data-type='next']");
    prevBtn?.addEventListener("click", () => {
        inputElement.dispatchEvent(createAssetMenuArrowKeyEvent("ArrowUp"));
    });
    nextBtn?.addEventListener("click", () => {
        inputElement.dispatchEvent(createAssetMenuArrowKeyEvent("ArrowDown"));
    });

    renderAssetList({element, k: "", position, exts: extsRef.current});
};

/**
 * 资源选择菜单
 * @description 移动端使用原有 Menu 实现，桌面端使用全局单例 Dialog
 * @param protyle - 编辑器实例（移动端需要）
 * @param position - 位置信息（移动端需要）
 * @param destination - 资源选择结果的去向，并据此保持对应的菜单生命周期
 * @param exts - 文件扩展名过滤列表
 * @同步豁免: UI构建 - 菜单构建必须在同一调用栈内同步完成，避免弹出位置与事件绑定时序错位。
 */
export const assetMenu = ({protyle, position, destination, exts}: AssetMenuOptions) => {
    // 移动端保持原有 Menu 实现
    if (isMobile) {
        const menu = getSiyuanGlobalMenus().menu;
        menu.remove();
        menu.append(MenuItem.create({
            iconHTML: "",
            type: "readonly",
            label: 生成菜单HTML模板(),
            /** @简洁函数 绑定菜单根元素事件与初始渲染 */
            bind(element) {
                绑定菜单元素事件({
                    element,
                    position,
                    protyle,
                    destination,
                    ...(exts ? {exts} : {}),
                });
            }
        }).element);
        menu.popup(position);
        return;
    }
    // 桌面端使用全局单例 Dialog，由资源去向接管选中结果。
    openAssetDialog(destination.select);
};
