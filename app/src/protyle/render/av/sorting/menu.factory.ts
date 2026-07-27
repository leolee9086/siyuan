/** 用途：提供添加排序菜单身份；使用范围：Sort 菜单工厂；解耦评估：经本域网关直达协议常量。 */
import {Constants} from "./imports";
/** 用途：实例化添加排序菜单；使用范围：Sort 菜单工厂；解耦评估：经本域网关直达 Menu 实现。 */
import {Menu} from "./imports";

/** 创建一次性的添加排序菜单实例，不持有或注册跨调用状态。 */
/** @同步豁免: UI构建 */
export const createSortMenu = () => new Menu(Constants.MENU_AV_ADD_SORT);
