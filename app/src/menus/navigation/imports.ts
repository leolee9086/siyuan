/**
 * 用途：读取文件树排序菜单的本地化标签。
 * 使用范围：仅用于 navigation 子域的排序菜单构建。
 * 解耦评估：国际化环境入口是当前 UI 文案的唯一所有者，本域网关直达实现，不经其它 imports 网关转发。
 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出国际化环境供排序菜单工厂使用。 */
export {siyuanI18n};
