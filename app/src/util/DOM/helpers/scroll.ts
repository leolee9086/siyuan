/**
 * 把滚动目标值限制在容器可滚动范围内，避免在边界处出现越界写入。
 * 调用时机：本文件所有滚动函数在命中边界时统一调用。
 * 问题/改进：逻辑非常轻量，保留独立函数是为了让各分支复用同一裁剪规则。
 */
const clampScrollOffset = (value: number, max: number): number => {
    const limitedValue = Math.max(0, value);
    const clampedValue = Math.min(max, limitedValue);
    return clampedValue;
};

/**
 * 从滚轮事件中解析可滚动容器，避免在空目标上继续执行滚动逻辑。
 * 调用时机：本文件的水平/垂直滚动工具在处理事件入口时统一调用。
 * 问题/改进：当前仅接受 `currentTarget` 为 HTMLElement 的情况，若以后有 ShadowRoot 代理可再扩展。
 */
const resolveScrollContainer = (event: WheelEvent): HTMLElement | undefined => {
    const currentTarget = event.currentTarget;
    const isHtmlElement = currentTarget instanceof HTMLElement;
    if (!isHtmlElement) {
        return undefined;
    }
    return currentTarget;
};

/**
 * 优先执行水平滚动，只有在左右边界无法继续移动时才把事件交给垂直滚动。
 * 调用时机：横向滚动容器希望优先消费 `deltaX` 时调用。
 * 问题/改进：当前仍依赖同步 DOM 读写，若未来统一接入手势层可进一步收敛。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function horizontalScrollFirst(event: WheelEvent): void {
    const container = resolveScrollContainer(event);
    if (!container) {
        return;
    }
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = container.scrollLeft + event.deltaX;
    const reachesStart = nextScrollLeft <= 0 && event.deltaX < 0;
    const reachesEnd = nextScrollLeft >= maxScrollLeft && event.deltaX > 0;
    const shouldDelegateVertical = reachesStart || reachesEnd;
    if (!shouldDelegateVertical) {
        event.preventDefault();
        event.stopPropagation();
        container.scrollLeft = nextScrollLeft;
        return;
    }
    container.scrollLeft = clampScrollOffset(nextScrollLeft, maxScrollLeft);
    verticalScroll(event);
}

/**
 * 优先执行垂直滚动，只有在上下边界无法继续移动时才把事件交给水平滚动。
 * 调用时机：纵向滚动容器希望优先消费 `deltaY` 时调用。
 * 问题/改进：当前只处理单层容器，如未来需要级联滚动策略可在此统一扩展。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function verticalScrollFirst(event: WheelEvent): void {
    const container = resolveScrollContainer(event);
    if (!container) {
        return;
    }
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const nextScrollTop = container.scrollTop + event.deltaY;
    const reachesTop = nextScrollTop <= 0 && event.deltaY < 0;
    const reachesBottom = nextScrollTop >= maxScrollTop && event.deltaY > 0;
    const shouldDelegateHorizontal = reachesTop || reachesBottom;
    if (!shouldDelegateHorizontal) {
        event.preventDefault();
        container.scrollTop = nextScrollTop;
        return;
    }
    container.scrollTop = clampScrollOffset(nextScrollTop, maxScrollTop);
    horizontalScroll(event);
}

/**
 * 将滚轮输入映射成垂直滚动，并在容器尚有可滚动空间时消费事件。
 * 调用时机：需要把触控板或鼠标滚轮统一折算成纵向滚动时调用。
 * 问题/改进：当前把 `deltaX` 叠加到纵向位移中，若后续要区分设备类型可进一步细化。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function verticalScroll(event: WheelEvent): void {
    const container = resolveScrollContainer(event);
    if (!container) {
        return;
    }
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const delta = event.deltaY + event.deltaX;
    const nextScrollTop = container.scrollTop + delta;
    const reachesTop = nextScrollTop <= 0 && delta < 0;
    const reachesBottom = nextScrollTop >= maxScrollTop && delta > 0;
    const shouldBubble = reachesTop || reachesBottom;
    if (shouldBubble) {
        container.scrollTop = clampScrollOffset(nextScrollTop, maxScrollTop);
        return;
    }
    event.preventDefault();
    container.scrollTop = nextScrollTop;
}

/**
 * 将滚轮输入映射成水平滚动，并在容器尚有可滚动空间时消费事件。
 * 调用时机：PDF 预览等横向内容容器需要把触控板输入映射成横向滚动时调用。
 * 问题/改进：当前把 `deltaY` 叠加到横向位移中，便于触控板体验，但未来可考虑配置化。
 * @同步豁免: 需要绝对同步的DOM访问
 */
export function horizontalScroll(event: WheelEvent): void {
    const container = resolveScrollContainer(event);
    if (!container) {
        return;
    }
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const delta = event.deltaY + event.deltaX;
    const nextScrollLeft = container.scrollLeft + delta;
    const reachesStart = nextScrollLeft <= 0 && delta < 0;
    const reachesEnd = nextScrollLeft >= maxScrollLeft && delta > 0;
    const shouldBubble = reachesStart || reachesEnd;
    if (shouldBubble) {
        container.scrollLeft = clampScrollOffset(nextScrollLeft, maxScrollLeft);
        return;
    }
    event.preventDefault();
    container.scrollLeft = nextScrollLeft;
}
