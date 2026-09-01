import { matchHotKey } from "../util/hotKey";
import { getContenteditableElement } from "./getBlock";
import { listIndent, listOutdent } from "./list";
import {turnsIntoOneTransaction} from "./transaction/turns/container";
import {turnsOneInto} from "./transaction/turns/single";
import {updateTransaction} from "./transaction/update";
import * as dayjs from "dayjs";
import { hasClosestByAttribute } from "../util/hasClosest";
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * 列表缩出快捷键中间件（旧实现 - 已废弃）
 *
 * @deprecated 此实现已被 keydown.list/middlewares/outdent.ts 中的新实现替代
 * 新实现使用 CalibURRouter 模式，提供更好的可维护性和可测试性
 * 保留此代码仅供参考，后续将完全移除
 *
 * 处理列表项的缩进和缩出操作
 */
// export const listOutdentMiddleware = async (
//     event: KeyboardEvent,
//     protyle: IProtyle,
//     nodeElement: HTMLElement,
//     range: Range,
//     controller: AbortController
// ) => {
//     if (matchHotKey(window.siyuan.config.keymap.editor.list.outdent.custom, event)) {
//         const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
//         if (selectElements.length > 0) {
//             let isContinuous = true;
//             selectElements.forEach((item, index) => {
//                 if (item.nextElementSibling && selectElements[index + 1]) {
//                     if (selectElements[index + 1] !== item.nextElementSibling) {
//                         isContinuous = false;
//                     }
//                 }
//             });
//             if (isContinuous &&
//                 (selectElements[0].classList.contains("li") || selectElements[0].parentElement.classList.contains("li"))) {
//                 listOutdent(protyle, Array.from(selectElements), range);
//             }
//             event.preventDefault();
//             event.stopPropagation();
//             controller.abort("列表缩出操作");
//             return;
//         } else if (nodeElement.parentElement.classList.contains("li") && nodeElement.getAttribute("data-type") !== "NodeCodeBlock") {
//             listOutdent(protyle, [nodeElement.parentElement], range);
//             event.preventDefault();
//             event.stopPropagation();
//             controller.abort("列表缩出操作");
//             return;
//         }
//     }
// };

/**
 * 列表缩进快捷键中间件（旧实现 - 已废弃）
 *
 * @deprecated 此实现已被 keydown.list/middlewares/indent.ts 中的新实现替代
 * 新实现使用 CalibURRouter 模式，提供更好的可维护性和可测试性
 * 保留此代码仅供参考，后续将完全移除
 *
 * 处理列表项的缩进操作
 */
// export const listIndentMiddleware = async (
//     event: KeyboardEvent,
//     protyle: IProtyle,
//     nodeElement: HTMLElement,
//     range: Range,
//     controller: AbortController
// ) => {
//     if (matchHotKey(window.siyuan.config.keymap.editor.list.indent.custom, event)) {
//         const selectElements = protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select");
//         if (selectElements.length > 0) {
//             let isContinuous = true;
//             selectElements.forEach((item, index) => {
//                 if (item.nextElementSibling && selectElements[index + 1]) {
//                     if (selectElements[index + 1] !== item.nextElementSibling) {
//                         isContinuous = false;
//                     }
//                 }
//             });
//             if (isContinuous &&
//                 (selectElements[0].classList.contains("li") || selectElements[0].parentElement.classList.contains("li"))) {
//                 listIndent(protyle, Array.from(selectElements), range);
//             }
//             event.preventDefault();
//             event.stopPropagation();
//             controller.abort("列表缩进操作");
//             return;
//         } else if (nodeElement.parentElement.classList.contains("li") && nodeElement.getAttribute("data-type") !== "NodeCodeBlock") {
//             listIndent(protyle, [nodeElement.parentElement], range);
//             event.preventDefault();
//             event.stopPropagation();
//             controller.abort("列表缩进操作");
//             return;
//         }
//     }
// };

/**
 * 列表类型转换快捷键中间件（旧实现 - 已废弃）
 *
 * @deprecated 此实现已被 keydown.list/middlewares/transform.ts 中的新实现替代
 * 新实现使用 CalibURRouter 模式，提供更好的可维护性和可测试性
 *
 * ⚠️ 警告：此文件中的代码已不再使用！
 * keydown.ts 现在通过 keydown.list/index.ts 导入新版本的 CalibURRouter 实现
 *
 * 保留此代码仅供参考，后续将完全移除
 *
 * 处理无序列表、有序列表、任务列表和引用之间的转换
 */
// export const listTransformMiddleware = async (
//     event: KeyboardEvent,
//     protyle: IProtyle,
//     nodeElement: HTMLElement,
//     range: Range,
//     controller: AbortController
// ) => {
//     const isMatchList = matchHotKey(window.siyuan.config.keymap.editor.insert.list.custom, event);
//     const isMatchCheck = matchHotKey(window.siyuan.config.keymap.editor.insert.check.custom, event);
//     const isMatchOList = matchHotKey(window.siyuan.config.keymap.editor.insert["ordered-list"].custom, event);
//     const isMatchQuote = matchHotKey(window.siyuan.config.keymap.editor.insert.quote.custom, event);
//
//     if (isMatchList || isMatchOList || isMatchCheck || isMatchQuote) {
//         const selectsElement: HTMLElement[] = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
//         if (selectsElement.length === 0) {
//             selectsElement.push(nodeElement);
//         }
//         if (selectsElement.length === 1) {
//             const subType = selectsElement[0].dataset.subtype;
//             const type = selectsElement[0].dataset.type;
//             if (isMatchQuote) {
//                 if (["NodeHeading", "NodeParagraph", "NodeList"].includes(type)) {
//                     turnsIntoOneTransaction({
//                         protyle,
//                         selectsElement,
//                         type: "Blocks2Blockquote"
//                     });
//                 } else {
//                     protyle.hint.splitChar = "/";
//                     protyle.hint.lastIndex = -1;
//                     protyle.hint.fill(">" + Lute.Caret, protyle);
//                 }
//             } else {
//                 if (type === "NodeParagraph") {
//                     turnsIntoOneTransaction({
//                         protyle,
//                         selectsElement,
//                         type: isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs")
//                     });
//                 } else if (type === "NodeList") {
//                     const id = selectsElement[0].dataset.nodeId;
//                     if (subType === "o" && (isMatchList || isMatchCheck)) {
//                         turnsOneInto({
//                             protyle,
//                             nodeElement: selectsElement[0],
//                             id,
//                             type: isMatchCheck ? "UL2TL" : "OL2UL",
//                         });
//                     } else if (subType === "t" && (isMatchList || isMatchOList)) {
//                         turnsOneInto({
//                             protyle,
//                             nodeElement: selectsElement[0],
//                             id,
//                             type: isMatchList ? "TL2UL" : "TL2OL",
//                         });
//                     } else if (subType === "u" && (isMatchCheck || isMatchOList)) {
//                         turnsOneInto({
//                             protyle,
//                             nodeElement: selectsElement[0],
//                             id,
//                             type: isMatchCheck ? "OL2TL" : "UL2OL",
//                         });
//                     }
//                 } else {
//                     protyle.hint.splitChar = "/";
//                     protyle.hint.lastIndex = -1;
//                     protyle.hint.fill((isMatchCheck ? "- [ ] " : (isMatchList ? "- " : "1. ")) + Lute.Caret, protyle);
//                 }
//             }
//         } else {
//             let isList = false;
//             let isContinue = false;
//             selectsElement.find((item, index) => {
//                 if (item.classList.contains("li")) {
//                     isList = true;
//                     return true;
//                 }
//                 if (item.nextElementSibling && selectsElement[index + 1] &&
//                     item.nextElementSibling === selectsElement[index + 1]) {
//                     isContinue = true;
//                 } else if (index !== selectsElement.length - 1) {
//                     isContinue = false;
//                     return true;
//                 }
//             });
//             if (!isList && isContinue) {
//                 turnsIntoOneTransaction({
//                     protyle,
//                     selectsElement,
//                     type: isMatchQuote ? "Blocks2Blockquote" : (isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs"))
//                 });
//             }
//         }
//         event.preventDefault();
//         event.stopPropagation();
//         controller.abort("列表类型转换操作");
//         return;
//     }
// };

/**
 * 任务列表切换快捷键中间件（旧实现 - 已废弃）
 *
 * @deprecated 此实现已被 keydown.list/middlewares/checkToggle.ts 中的新实现替代
 * 新实现使用 CalibURRouter 模式，提供更好的可维护性和可测试性
 * 保留此代码仅供参考，后续将完全移除
 *
 * 处理任务列表项的完成状态切换
 */
// export const listCheckToggleMiddleware = async (
//     event: KeyboardEvent,
//     protyle: IProtyle,
//     nodeElement: HTMLElement,
//     range: Range,
//     controller: AbortController
// ) => {
//     if (matchHotKey(getSiyuanConfig().keymap.editor.list.checkToggle.custom, event)) {
//         const taskItemElement = hasClosestByAttribute(range.startContainer, "data-subtype", "t");
//         if (!taskItemElement) {
//             return;
//         }
//         const html = taskItemElement.outerHTML;
//         if (taskItemElement.classList.contains("protyle-task--done")) {
//             taskItemElement.querySelector("use").setAttribute("xlink:href", "#iconUncheck");
//             taskItemElement.classList.remove("protyle-task--done");
//         } else {
//             taskItemElement.querySelector("use").setAttribute("xlink:href", "#iconCheck");
//             taskItemElement.classList.add("protyle-task--done");
//         }
//         taskItemElement.setAttribute("updated", dayjs().format("YYYYMMDDHHmmss"));
//         updateTransaction(protyle, taskItemElement.getAttribute("data-node-id"), taskItemElement.outerHTML, html);
//         event.preventDefault();
//         event.stopPropagation();
//         controller.abort("任务列表状态切换操作");
//         return;
//     }
// };