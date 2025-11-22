import { reactive, ref } from "vue";

export const useDragable = () => {
    const dragState = ref({
        scale: 1.0,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0,
        dragStartTranslateX: 0,
        dragStartTranslateY: 0
    });
}   

const startDrag = (event: MouseEvent, dragState: any) => {
    dragState.isDragging = true;
    dragState.dragStartX = event.clientX;   
    dragState.dragStartY = event.clientY;
    dragState.dragStartTranslateX = dragState.translateX;
    dragState.dragStartTranslateY = dragState.translateY;
}   