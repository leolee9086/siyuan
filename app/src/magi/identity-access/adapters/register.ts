/** 用途：统一 Tab 注册中心；使用范围：启动注册；解耦评估：跨目录依赖由 adapters 网关集中转发。 */
import * as imports from "./imports";
/** 用途：Identity Access Tab 初始化和类型；使用范围：注册配置；解耦评估：同层稳定入口。 */
import * as tab from "./tab";

imports.tabRegistry.register({
    type: tab.MAGI_IDENTITY_ACCESS_TAB_TYPE,
    init: tab.initIdentityAccessTab,
});
