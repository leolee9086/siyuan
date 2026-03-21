export const IFRAME_INTERACTION_LOCK_CLASS = "layout--iframe-interaction-lock";

const LOCK_COUNT_ATTR = "data-iframe-interaction-lock-count";

const getBody = (): HTMLBodyElement | null => {
    if (typeof document === "undefined") {
        return null;
    }
    return document.body;
};

const readLockCount = (bodyElement: HTMLBodyElement): number => {
    const rawCount = bodyElement.getAttribute(LOCK_COUNT_ATTR) || "0";
    const parsedCount = Number.parseInt(rawCount, 10);
    if (!Number.isFinite(parsedCount) || parsedCount < 0) {
        return 0;
    }
    return parsedCount;
};

const writeLockCount = (bodyElement: HTMLBodyElement, count: number): void => {
    if (count <= 0) {
        bodyElement.removeAttribute(LOCK_COUNT_ATTR);
        bodyElement.classList.remove(IFRAME_INTERACTION_LOCK_CLASS);
        return;
    }
    bodyElement.setAttribute(LOCK_COUNT_ATTR, count.toString());
    bodyElement.classList.add(IFRAME_INTERACTION_LOCK_CLASS);
};

export const acquireIframeInteractionLock = (): void => {
    const bodyElement = getBody();
    if (!bodyElement) {
        return;
    }
    writeLockCount(bodyElement, readLockCount(bodyElement) + 1);
};

export const releaseIframeInteractionLock = (): void => {
    const bodyElement = getBody();
    if (!bodyElement) {
        return;
    }
    writeLockCount(bodyElement, readLockCount(bodyElement) - 1);
};
