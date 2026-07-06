export const isDragEventWithHTMLElement = (event: DragEvent): event is DragEvent & { target: HTMLElement } => {
    return event.target instanceof HTMLElement;
};
