/** 用途：更新时间字符串；使用范围：宽高调整提交事务时写入 updated；解耦评估：第三方依赖由 imports.ts 转发。 */
import { dayjs } from "./imports";
/** 用途：提交事务；使用范围：宽高调整后的持久化更新；解耦评估：事务入口统一。 */
import { updateTransaction } from "./imports";
/** 用途：读取全局菜单实例；使用范围：提交尺寸后关闭菜单；解耦评估：菜单实例由环境层统一管理。 */
import { getSiyuanGlobalMenusMenu } from "./imports";
/** 用途：恢复块焦点；使用范围：提交尺寸后返回编辑区；解耦评估：聚焦能力由工具层封装。 */
import { focusBlock } from "./imports";

/**
 * 作用：提交尺寸修改事务并关闭菜单。
 * 意图：集中复用宽度和高度菜单共同的收尾流程。
 * 调用时机：输入框 blur 或滑杆 change 时。
 * 问题/改进：后续可加“内容未变化跳过事务”优化减少历史噪音。
 */
/** @同步豁免: 生命周期 */
export const 提交尺寸事务并关闭菜单 = (
    protyle: IProtyle,
    nodeElement: HTMLElement,
    id: string,
    html: string
) => {
    nodeElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
    updateTransaction(protyle, nodeElement, html);
    getSiyuanGlobalMenusMenu().remove();
    focusBlock(nodeElement);
};
