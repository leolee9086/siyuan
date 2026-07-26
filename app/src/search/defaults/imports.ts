/** 用途：读取完整应用配置。使用范围：搜索默认类型从用户配置投影。解耦评估：环境读取是 defaults 子域唯一外部值依赖，不加载 Search UI、布局或 Dock 实现。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 导出搜索默认值使用的配置读取。 */
export {getSiyuanConfig};
