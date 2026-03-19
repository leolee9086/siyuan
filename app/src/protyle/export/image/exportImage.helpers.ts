/** 用途：导出图片上下文创建器；使用范围：导出流程初始化阶段；解耦评估：上下文构建逻辑独立后，主流程仅编排调用。 */
import {createExportImageContext} from "./exportImage.context";
/** 用途：导出预览请求函数；使用范围：初始化预览与 keepFold 切换；解耦评估：请求与渲染链路独立后更易测试。 */
import {requestExportImagePreview} from "./exportImage.preview";
/** 用途：导出确认处理函数；使用范围：点击确认按钮后执行截图与上传；解耦评估：重流程独立模块，便于后续性能优化。 */
import {handleConfirmExport} from "./exportImage.confirm";
/** 用途：水印刷新函数；使用范围：水印开关变更与预览刷新后；解耦评估：水印逻辑独立后可单独替换策略。 */
import {updateExportImageWatermark} from "./exportImage.watermark";
/** 用途：导出比例预览函数；使用范围：比例切换后更新导出画布最小高度；解耦评估：比例逻辑独立后可单独扩展分页策略。 */
import {applyExportImageRatioPreview} from "./exportImage.ratio";
/** 用途：导出图片上下文类型；使用范围：事件处理回调参数；解耦评估：类型依赖不引入运行时耦合。 */
import type {IExportImageContext} from "./exportImage.types";

/**
 * 作用：处理 keepFold 开关变化并刷新预览。
 * 意图：把事件回调主体独立命名，满足内联回调约束并提升可读性。
 * 调用时机：keepFold 复选框 change 事件。
 * 问题/改进：后续可增加并发请求取消，避免快速切换时旧结果覆盖新结果。
 */
const handleKeepFoldChange = async (ctx: IExportImageContext): Promise<void> => {
    ctx.storage.keepFold = ctx.keepFoldElement.checked;
    await requestExportImagePreview(ctx);
};

/**
 * 作用：处理水印开关变化并刷新水印层。
 * 意图：将开关状态同步与渲染更新放到单一函数，避免重复逻辑。
 * 调用时机：watermark 复选框 change 事件。
 * 问题/改进：后续可增加失败提示以改善异常可观测性。
 */
const handleWatermarkChange = async (ctx: IExportImageContext): Promise<void> => {
    ctx.storage.watermark = ctx.watermarkElement.checked;
    await updateExportImageWatermark(ctx);
};

/**
 * 作用：处理导出比例切换并刷新预览画布高度。
 * 意图：将比例状态同步和 UI 更新收敛到单点，避免在事件绑定处散落逻辑。
 * 调用时机：ratio 下拉框 change 事件。
 * 问题/改进：当前仅更新最小高度预览，后续可扩展为更完整的分页预估信息。
 */
const handleRatioChange = async (ctx: IExportImageContext): Promise<void> => {
    ctx.storage.ratio = ctx.ratioElement.value;
    applyExportImageRatioPreview(ctx);
    await updateExportImageWatermark(ctx);
};

/**
 * 作用：执行“导出为图片”完整流程。
 * 意图：作为编排层连接上下文创建、事件绑定、预览初始化与确认导出。
 * 调用时机：`exportImage` 入口函数调用时。
 * 问题/改进：目前依赖回调式接口，后续可统一为 Promise 数据流。
 */
// 导出语句注释：导出图片主流程编排入口。
export const runExportImageFlow = async (id: string, dialogKey: string): Promise<void> => {
    const ctx = await createExportImageContext(id, dialogKey);
    if (!ctx) {
        return;
    }

    ctx.cancelButton.addEventListener("click", () => {
        ctx.dialog.destroy();
    });
    ctx.confirmButton.addEventListener("click", () => {
         handleConfirmExport(ctx);
    });
    ctx.keepFoldElement.addEventListener("change", () => {
         handleKeepFoldChange(ctx);
    });
    ctx.watermarkElement.addEventListener("change", () => {
         handleWatermarkChange(ctx);
    });
    ctx.ratioElement.addEventListener("change", () => {
         handleRatioChange(ctx);
    });

    await requestExportImagePreview(ctx, (response) => {
        ctx.confirmButton.setAttribute("data-title", `${response.data.name}.png`);
    });
};
