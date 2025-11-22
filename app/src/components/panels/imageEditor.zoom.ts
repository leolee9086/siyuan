import { Ref } from "vue";

// 放大
export const zoomInWithCtx = (
    ctx: {
        scale: Ref<number>
        imageWrapper: Ref<HTMLElement | undefined>,
        translateX: Ref<number>,
        translateY: Ref<number>
        options: {
            zoomStep: number
            maxScale: number
            minScale: number
        }
        setScale: (newScale: number) => void
    },
) => {
    const newScale = Math.min(ctx.scale.value + ctx.options.zoomStep, ctx.options.maxScale);
    ctx.setScale(newScale);
};
export const zoomOutWithCtx = (
    ctx: {
        scale: Ref<number>
        imageWrapper: Ref<HTMLElement | undefined>,
        translateX: Ref<number>,
        translateY: Ref<number>
        options: {
            zoomStep: number
            maxScale: number
            minScale: number
        }
        setScale: (newScale: number) => void
    },
) => {
    const newScale = Math.max(ctx.scale.value - ctx.options.zoomStep, ctx.options.minScale);
    ctx.setScale(newScale);
};
export const resetZoomWithCtx = (
    ctx: {
        scale: Ref<number>
        options: {
            zoomStep: number
            minScale: number
        }
        setScale: (newScale: number) => void
    },
) => {
    ctx.setScale(1);
};






/**
 * DOM操作
 */
// 设置缩放并保持中心点
export const setScaleWithCtx = (ctx: {
    imageWrapper: Ref<HTMLElement | undefined>,
    scale: Ref<number>,
    translateX: Ref<number>,
    translateY: Ref<number>
}, newScale: number) => {
    if (ctx.imageWrapper.value && ctx.imageWrapper.value.parentElement) {
        const containerWidth = ctx.imageWrapper.value.parentElement.clientWidth;
        const containerHeight = ctx.imageWrapper.value.parentElement.clientHeight;
        // 计算当前中心点
        const centerX = containerWidth / 2;
        const centerY = containerHeight / 2;

        // 计算缩放前中心点在图片坐标系中的位置
        const imageCenterX = (centerX - ctx.translateX.value) / ctx.scale.value;
        const imageCenterY = (centerY - ctx.translateY.value) / ctx.scale.value;

        // 更新缩放
        ctx.scale.value = newScale;

        // 计算新的平移量，保持中心点不变
        ctx.translateX.value = centerX - imageCenterX * newScale;
        ctx.translateY.value = centerY - imageCenterY * newScale;
    }
};

export const centerImageWithCtx = (ctx: {
    imageWrapper: Ref<HTMLElement | undefined>,
    scale: Ref<number>,
    translateX: Ref<number>,
    translateY: Ref<number>,
    imageWidth: Ref<number>,
    imageHeight: Ref<number>
}) => {
    if (ctx.imageWrapper.value && ctx.imageWrapper.value.parentElement) {
        const containerWidth = ctx.imageWrapper.value.parentElement.clientWidth;
        const containerHeight = ctx.imageWrapper.value.parentElement.clientHeight;

        // 计算居中位置
        ctx.translateX.value = (containerWidth - ctx.imageWidth.value * ctx.scale.value) / 2;
        ctx.translateY.value = (containerHeight - ctx.imageHeight.value * ctx.scale.value) / 2;
    }
};
