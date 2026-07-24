/**
 * 用途：页签类型，表示单个页签实例
 * 使用范围：openTab函数返回值类型
 * 解耦评估：通过imports.ts转发
 */
import type { Tab } from "./imports";
/** 用途：应用主类类型。使用范围：OpenTab 命令的宿主绑定。解耦评估：具体身份仅在实现边界绑定。 */
import type {App} from "./imports";
/** 用途：布局模型类型。使用范围：OpenTab 回调的宿主绑定。解耦评估：具体身份仅在实现边界绑定。 */
import type {Model} from "./imports";

/**
 * 用途：常量定义，包含编辑器动作常量
 * 使用范围：处理文档打开时需要使用CB_GET_ALL常量
 * 解耦评估：通过imports.ts转发
 */
import { Constants } from "./imports";

/**
 * 用途：国际化文本获取函数
 * 使用范围：处理闪卡打开时需要显示多语言文本
 * 解耦评估：通过imports.ts转发
 */
import { siyuanI18n } from "./imports";

/**
 * 用途：文件打开工具函数
 * 使用范围：处理各类页签打开的底层实现
 * 解耦评估：通过imports.ts转发
 */
import { openFile } from "./imports";

/**
 * 用途：通过ID打开文件的工具函数
 * 使用范围：处理文档打开时通过文档ID加载
 * 解耦评估：通过imports.ts转发
 */
import { openFileById } from "./imports";

/**
 * 用途：平台检测函数，判断是否为移动端
 * 使用范围：openTab函数中需要根据平台决定是否支持页签
 * 解耦评估：通过imports.ts转发
 */
import { isMobile } from "./imports";

/**
 * 用途：openTab相关类型定义
 * 使用范围：openTab函数及其辅助函数的类型约束
 * 解耦评估：类型定义已移至独立types文件
 */
import type { IOpenTabOptions } from "./openTab.types";

/**
 * 用途：表示插件 API 在主应用宿主中执行的打开页签命令。
 * 使用场景：openTab 入口及各类页签处理函数共享同一组选项。
 * 关联类型：将通用 IOpenTabOptions 绑定到 App 和 Model 领域身份。
 */
type OpenTabOptions = IOpenTabOptions<App, Model>;

/** 处理文档打开 */
const 处理文档打开 = async (options: OpenTabOptions) => {
    const doc = options.doc;
    if (!doc) {
        return;
    }
    
    if (!doc.action) {
        doc.action = [];
    }
    
    // 如果需要聚焦模式且动作列表中没有CB_GET_ALL，则添加该动作以加载完整文档内容
    if (doc.zoomIn && !doc.action.includes(Constants.CB_GET_ALL)) {
        doc.action.push(Constants.CB_GET_ALL);
    }
    
    return openFileById({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        id: doc.id,
        action: doc.action,
        zoomIn: doc.zoomIn,
        mode: doc.mode
    });
};

/** 处理资源文件打开 */
const 处理资源打开 = async (options: OpenTabOptions) => {
    const asset = options.asset;
    if (!asset) {
        return;
    }
    
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        assetPath: asset.path,
    });
};

/** 处理PDF打开 */
const 处理PDF打开 = async (options: OpenTabOptions) => {
    const pdf = options.pdf;
    if (!pdf) {
        return;
    }
    
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        assetPath: pdf.path,
        page: pdf.id || pdf.page,
    });
};

/** 初始化搜索配置默认值 */
const 初始化搜索配置 = (search: Config.IUILayoutTabSearchConfig) => {
    if (!search.idPath) {
        search.idPath = [];
    }
    if (!search.hPath) {
        search.hPath = "";
    }
};

/** 处理搜索打开 */
const 处理搜索打开 = async (options: OpenTabOptions) => {
    const search = options.search;
    if (!search) {
        return;
    }
    
    初始化搜索配置(search);
    
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        searchData: search,
    });
};

/** 处理闪卡打开 */
const 处理闪卡打开 = async (options: OpenTabOptions) => {
    const card = options.card;
    if (!card) {
        return;
    }
    
    return openFile({
        app: options.app,
        keepCursor: options.keepCursor,
        removeCurrentTab: options.removeCurrentTab,
        position: options.position,
        afterOpen: options.afterOpen,
        custom: {
            icon: "iconRiffCard",
            title: siyuanI18n.spaceRepetition,
            data: {
                cardType: card.type,
                id: card.id || "",
                title: card.title,
            },
            id: "siyuan-card"
        },
    });
};

/**
 * 打开Tab页签的主函数
 * 支持打开文档、PDF、资源、搜索、闪卡、自定义等多种页签类型
 */
/** @显式返回类型原因: 异步函数返回 Tab 实例或 undefined，调用方需要根据返回值判断打开结果。显式标注确保类型安全，防止调用方遗漏 undefined 分支。 */
export const openTab = async (options: OpenTabOptions): Promise<Tab | undefined> => {
    // 移动端暂不支持Tab页签打开 TODO: Mobile
    if (isMobile()) {
        return;
    }
    
    if (options.doc) {
        return 处理文档打开(options);
    }
    
    if (options.asset) {
        return 处理资源打开(options);
    }
    
    if (options.pdf) {
        return 处理PDF打开(options);
    }
    
    if (options.search) {
        return 处理搜索打开(options);
    }
    
    if (options.card) {
        return 处理闪卡打开(options);
    }
    
    if (options.custom) {
        return openFile(options);
    }
};
