import { Ref } from "vue";
import { ZOOM_STEP, MIN_SCALE, MAX_SCALE } from "./imageEditor.consts";
// 鼠标滚轮缩放
export const handleWheelWithCtx = (ctx: {
    scale: Ref<number>,
    imageWrapper: Ref<HTMLElement | undefined>,
    translateX: Ref<number>,
    translateY: Ref<number>,
    setScaleWithCtx: Function,
    zoomInWithCtx: Function,
    zoomOutWithCtx: Function,
}, event: WheelEvent) => {
    event.preventDefault();
    const { scale, imageWrapper, translateX, translateY, setScaleWithCtx, zoomInWithCtx, zoomOutWithCtx } = ctx;
    if (event.deltaY < 0) {
        zoomInWithCtx({
            scale,
            imageWrapper,
            translateX,
            translateY,
            options: {
                zoomStep: ZOOM_STEP,
                minScale: MIN_SCALE,
                maxScale: MAX_SCALE
            }, setScale: (newScale: number) => {
                setScaleWithCtx({
                    scale,
                    translateX,
                    translateY,
                    imageWrapper,
                }, newScale);
            }

        });
    } else {
        zoomOutWithCtx({
            scale,
            imageWrapper,
            translateX,
            translateY,
            options: {
                zoomStep: ZOOM_STEP,
                minScale: MIN_SCALE,
                maxScale: MAX_SCALE
            },
            setScale: (newScale: number) => {
                setScaleWithCtx({
                    scale,
                    translateX,
                    translateY,
                    imageWrapper,
                }, newScale);
            }
        });
    }
};
