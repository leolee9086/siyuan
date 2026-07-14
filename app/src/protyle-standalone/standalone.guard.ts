/** 用途：迁移期满足当前 Protyle 构造器的 App 类型；使用范围：仅独立入口；解耦评估：待 ExtensionPort 落地后删除。 */
import type {App} from "../index";
/** 用途：接收 Protyle 菜单能力协议；使用范围：独立入口兼容全局；解耦评估：全局桥接删除后接口继续保留。 */
import type {IProtyleMenuPort} from "../protyle/runtime/menu.types";
/** 用途：在写入遗留全局前校验菜单宿主；使用范围：独立入口菜单注册；解耦评估：未来公开宿主注册 API 继续复用。 */
import {parseProtyleMenuPort} from "./imports";

/** 将最小独立宿主对象转换为迁移期 App 类型。 */
export const asStandaloneApp = (value: unknown): App => value as App;

/** 将独立菜单容器转换为迁移期思源菜单类型。 */
export const asStandaloneMenus = (menu: IProtyleMenuPort): ISiyuan["menus"] => ({
    menu: parseProtyleMenuPort(menu),
}) as ISiyuan["menus"];
