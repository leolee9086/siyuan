/**
 * 用途：注册自定义 Tab 的统一注册中心。
 * 使用范围：当前文件负责在启动阶段注册 bazaar 相关 Tab。
 * 解耦评估：注册表属于框架基础设施，业务模块通过网关导入以收敛依赖边界。
 */
import { tabRegistry } from "./imports";

/**
 * 用途：集市广场 Tab 初始化函数。
 * 使用范围：当用户打开 bazaar hub 类型页签时由注册中心调用。
 * 解耦评估：属于同目录业务模块，保持直接同层依赖可清晰表达职责边界。
 */
import { initBazaarHub } from "./initHub";

/**
 * 用途：发布设置 Tab 初始化函数。
 * 使用范围：当用户打开 bazaar publish 类型页签时由注册中心调用。
 * 解耦评估：属于同目录业务模块，保持直接同层依赖可清晰表达职责边界。
 */
import { initBazaarPublish } from "./initPublish";

/**
 * 用途：第三方源页面 Tab 初始化函数。
 * 使用范围：当用户打开 bazaar source 类型页签时由注册中心调用。
 * 解耦评估：属于同目录业务模块，保持直接同层依赖可清晰表达职责边界。
 */
import { initBazaarSourceTab } from "./initSource";

/**
 * 用途：集市广场 Tab 类型常量。
 * 使用范围：注册表中的 type 字段。
 * 解耦评估：常量同目录维护可避免魔法值散落。
 */
import { BAZAAR_HUB_TAB_TYPE } from "./constants";

/**
 * 用途：发布设置 Tab 类型常量。
 * 使用范围：注册表中的 type 字段。
 * 解耦评估：常量同目录维护可避免魔法值散落。
 */
import { BAZAAR_PUBLISH_TAB_TYPE } from "./constants";

/**
 * 用途：第三方源 Tab 类型常量。
 * 使用范围：注册表中的 type 字段。
 * 解耦评估：常量同目录维护可避免魔法值散落。
 */
import { BAZAAR_SOURCE_TAB_TYPE } from "./constants";

/**
 * 用途：注册 bazaar hub Tab 类型。
 * 调用时机：模块加载时立即执行一次。
 * 问题/改进：注册顺序当前固定，如后续有依赖关系可改为显式初始化入口。
 */
tabRegistry.register({
    type: BAZAAR_HUB_TAB_TYPE,
    init: initBazaarHub,
});

/**
 * 用途：注册 bazaar publish Tab 类型。
 * 调用时机：模块加载时立即执行一次。
 * 问题/改进：注册顺序当前固定，如后续有依赖关系可改为显式初始化入口。
 */
tabRegistry.register({
    type: BAZAAR_PUBLISH_TAB_TYPE,
    init: initBazaarPublish,
});

/**
 * 用途：注册 bazaar source Tab 类型。
 * 调用时机：模块加载时立即执行一次。
 * 问题/改进：注册顺序当前固定，如后续有依赖关系可改为显式初始化入口。
 */
tabRegistry.register({
    type: BAZAAR_SOURCE_TAB_TYPE,
    init: initBazaarSourceTab,
});
