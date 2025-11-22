import { Ref } from "vue";

// 图片加载完成
export const onImageLoadWithCtx = (ctx: {
    imageElement: Ref<HTMLImageElement | undefined>,
    imageWidth: Ref<number>,
    imageHeight: Ref<number>,
    originImageElement: Ref<HTMLImageElement | undefined>,
    setOriginalImageFn: () => void
}, cb: () => void) => {
    if (ctx.imageElement.value) {
        ctx.imageWidth.value = ctx.imageElement.value.naturalWidth;
        ctx.imageHeight.value = ctx.imageElement.value.naturalHeight;

        // 保存原始图像元素的副本，确保不会被修改
        if (!ctx.originImageElement.value) {
            ctx.originImageElement.value = new Image();
            ctx.originImageElement.value.src = ctx.imageElement.value.src;
            ctx.originImageElement.value.onload = () => {
                // 设置原始图像到图像处理composable
                ctx.setOriginalImageFn;
            };
        } else {
            // 如果已存在，确保src正确
            if (ctx.originImageElement.value.src !== ctx.imageElement.value.src) {
                ctx.originImageElement.value.onload = () => {
                    // 设置原始图像到图像处理composable
                    ctx.setOriginalImageFn;
                };
            } else {
                // 设置原始图像到图像处理composable
                ctx.setOriginalImageFn;
            }
        }
        cb && cb();
    }
};
