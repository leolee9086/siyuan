import { Ref } from "vue";
import type { ToolbarItem } from "../imageToolbar.vue";
import { ZOOM_STEP, MIN_SCALE, MAX_SCALE } from "./imageEditor.consts";
export const createToolbarItems = (
    ctx: {
        scale: Ref<number>,
        imageWrapper: Ref<HTMLElement | undefined>,
        translateX: Ref<number>,
        translateY: Ref<number>,
        showDehazePanel: { value: boolean },
        toggleOriginalImage: Function,
        showOriginalImage: { value: boolean },
        hasDehazedImage: { value: boolean },
        setScaleWithCtx: Function,
        zoomInWithCtx: Function,
        zoomOutWithCtx: Function,
        resetZoomWithCtx: Function,
        toggleDehazePanel: Function,

    }
): ToolbarItem[] => {
    const { scale,
        imageWrapper,
        translateX,
        translateY,
        setScaleWithCtx,
        zoomInWithCtx,
        zoomOutWithCtx,
        resetZoomWithCtx,
        toggleDehazePanel,
        showDehazePanel,
        toggleOriginalImage,
        showOriginalImage,
        hasDehazedImage } = ctx;
    return [
        {
            id: "zoom-out",
            type: "button",
            icon: "iconMin",
            action: () => {
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
                        setScaleWithCtx(ctx, newScale);

                    }

                });
            }
        },
        {
            id: "zoom-level",
            type: "zoom-level"
        },
        {
            id: "zoom-in",
            type: "button",
            icon: "iconAdd",
            action: () => {
                zoomInWithCtx({
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
                        setScaleWithCtx(ctx, newScale);

                    }
                });
            }
        },
        {
            id: "spacer-1",
            type: "spacer"
        },
        {
            id: "reset-zoom",
            type: "button",
            icon: "iconRefresh",
            action: () => {
                resetZoomWithCtx({
                    scale,
                    options: {
                        zoomStep: ZOOM_STEP,
                        minScale: MIN_SCALE
                    },
                    setScale: (newScale: number) => {
                        setScaleWithCtx(ctx, newScale);

                    }
                });
            }
        },
        {
            id: "spacer-2",
            type: "spacer"
        },
        {
            id: "toggle-dehaze-panel",
            type: "button",
            icon: "iconEdit",
            title: "去雾处理",
            action: () => {
                toggleDehazePanel();
            },
            activeCondition: () => showDehazePanel.value
        },
        {
            id: "toggle-original-image",
            type: "button",
            icon: "iconCompare",
            title: "切换原图/去雾图",
            action: () => {
                toggleOriginalImage();
            },
            condition: () => hasDehazedImage.value,
            activeCondition: () => !showOriginalImage.value
        }
    ];
};