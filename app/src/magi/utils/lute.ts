let luteInstance: Lute | null = null;

function createLute(): Lute | null {
    if (typeof Lute === "undefined") {
        return null;
    }
    try {
        const lute = Lute.New();
        lute.SetHeadingID(false);
        lute.SetYamlFrontMatter(false);
        lute.SetToC(false);
        lute.SetIndentCodeBlock(false);
        lute.SetParagraphBeginningSpace(true);
        lute.SetSetext(false);
        lute.SetFootnotes(false);
        lute.SetLinkRef(false);
        lute.SetSanitize(true);
        lute.SetKramdownIAL(true);
        lute.SetTag(true);
        lute.SetSuperBlock(true);
        lute.SetBlockRef(true);
        lute.SetProtyleWYSIWYG(true);
        lute.SetSpin(true);
        return lute;
    } catch {
        return null;
    }
}

export function getLute(): Lute | null {
    if (!luteInstance) {
        luteInstance = createLute();
    }
    return luteInstance;
}

export function renderMarkdown(md: string): string {
    const lute = getLute();
    if (!lute || !md) {
        return md || "";
    }
    try {
        return lute.Md2BlockDOM(md);
    } catch {
        return md;
    }
}
