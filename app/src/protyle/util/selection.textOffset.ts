type OffsetLocation = {
    node?: Node,
    offset: number,
    lastNode?: Node,
};

const getOffsetLength = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
        return (node as Text).data.length;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return undefined;
    }
    const element = node as Element;
    if (element.tagName === "BR" || element.classList.contains("emoji")) {
        return 1;
    }
    return undefined;
};

const locateOffset = (container: Element, offset: number): OffsetLocation => {
    let remaining = offset;
    let lastNode: Node | undefined;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(node) {
            return getOffsetLength(node) === undefined ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_ACCEPT;
        }
    });
    let node = walker.nextNode();
    while (node) {
        lastNode = node;
        const length = getOffsetLength(node);
        if (length === undefined) {
            node = walker.nextNode();
            continue;
        }
        if (remaining <= length) {
            return {node, offset: remaining, lastNode};
        }
        remaining -= length;
        node = walker.nextNode();
    }
    return {offset: remaining, lastNode};
};

const setRangeBoundary = (
    range: Range,
    container: Element,
    location: OffsetLocation,
    setStart: boolean,
) => {
    const setBoundary = setStart ? range.setStart.bind(range) : range.setEnd.bind(range);
    const setBoundaryAfter = setStart ? range.setStartAfter.bind(range) : range.setEndAfter.bind(range);
    const node = location.node || location.lastNode;
    if (!node) {
        setBoundary(container, 0);
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        setBoundary(node, Math.min(location.offset, (node as Text).data.length));
        return;
    }
    setBoundaryAfter(node);
};

export const focusByTextOffset = (container: Element, start: number, end: number) => {
    if (!container) {
        return false;
    }
    const range = document.createRange();
    setRangeBoundary(range, container, locateOffset(container, start), true);
    if (start === end) {
        range.collapse(true);
    } else {
        setRangeBoundary(range, container, locateOffset(container, end), false);
    }
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
    }
    return range;
};
