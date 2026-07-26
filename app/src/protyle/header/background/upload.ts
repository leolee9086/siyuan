import { uploadFiles } from "../../upload";
import { fetchPost } from "../../../util/network/fetch";
import type {BackgroundDomain} from "./background.types";
import { renderBackground } from "./render";

/**
 * 作用：处理上传成功后的回调。
 * 意图：统一处理题头图上传成功后的后续逻辑（更新 IAL、渲染背景、同步后端）。
 */
const onUploadSuccess = (background: BackgroundDomain, protyle: IProtyle, responseText: string) => {
    const response = JSON.parse(responseText);
    const key = Object.keys(response.data.succMap)[0];
    if (!key) {
        return;
    }
    const style = `background-image:url("${response.data.succMap[key]}")`;
    background.ial["title-img"] = style;
    const rootID = protyle.block.rootID;
    if (!rootID) {
        throw new Error("protyle结构错误,protyle.block.rootID不存在");
    }
    renderBackground(background, background.ial, rootID);
    fetchPost("/api/attr/setBlockAttrs", {
        id: rootID,
        attrs: { "title-img": style }
    });
};

/**
 * 作用：处理拖拽放置事件。
 * 意图：验证并处理拖入的图片文件。
 */
const handleDrop = (background: BackgroundDomain, protyle: IProtyle, event: DragEvent) => {
    if (!event.dataTransfer) {
        return;
    }
    const file = event.dataTransfer.files[0];
    if (event.dataTransfer.types[0] === "Files" && file && file.type.indexOf("image") !== -1) {
        uploadFiles(protyle, [file], undefined, (responseText) => onUploadSuccess(background, protyle, responseText));
    }
};

/**
 * 作用：处理题头图区域的拖拽上传事件。
 * 意图：允许用户将图片文件拖入题头图区域直接上传并设置为题头。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：已提取公共函数 onUploadSuccess。
 */
export const bindDropEvent = (background: BackgroundDomain, protyle: IProtyle) => {
    background.element.addEventListener("dragover", (event) => {
        event.preventDefault();
    });
    background.element.addEventListener("drop", (event: DragEvent) => handleDrop(background, protyle, event));
};

/**
 * 作用：处理上传输入框变化事件。
 * 意图：当用户选择文件后触发上传。
 */
const handleUploadChange = (background: BackgroundDomain, protyle: IProtyle, event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.files && target.files.length > 0) {
        uploadFiles(protyle, target.files, target, (responseText) => onUploadSuccess(background, protyle, responseText));
    }
};

/**
 * 作用：处理点击按钮上传题头图的事件。
 * 意图：监听隐藏的文件输入框变化，将用户选中的本地图片上传并设置为题头。
 * 调用时机：组件初始化时绑定事件。
 * 问题/改进：已提取公共函数 onUploadSuccess。
 */
export const bindUploadEvent = (background: BackgroundDomain, protyle: IProtyle) => {
    const input = background.element.querySelector("input");
    if (!input) {
        return;
    }
    input.addEventListener("change", (event: Event) => handleUploadChange(background, protyle, event));
};
