/** 用途：打开移动端全屏搜索模型；使用范围：移动 AppFacade 全局搜索能力；解耦评估：经移动子域网关直达唯一实现，保持与桌面页签宿主分离。 */
import {popSearch} from "./imports";
/** 用途：约束移动搜索宿主；使用范围：移动 AppFacade 委托；解耦评估：纯类型经子域网关直达完整外观。 */
import type {AppFacade} from "./imports";

/** 将统一全局搜索请求映射为移动端既有全屏搜索配置。 */
/** @同步豁免: UI构建 - popSearch 在当前点击事件栈内挂载移动搜索模型，延迟会改变焦点与选区读取时机。 */
export const openMobileGlobalSearch = (app: AppFacade, options: {
    text: string;
    searchData?: Config.IUILayoutTabSearchConfig | undefined;
}) => {
    const searchData = options.searchData;
    popSearch(app, {
        ...searchData,
        hasReplace: false,
        hPath: searchData?.hPath ?? "",
        idPath: searchData?.idPath ?? [],
        k: options.text,
        r: "",
        page: searchData?.page ?? 1,
    });
};
