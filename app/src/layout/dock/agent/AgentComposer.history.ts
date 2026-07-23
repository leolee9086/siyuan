/** 管理 Composer 已发送消息历史，编辑器实现只负责读写当前草稿。 */
export class ComposerHistory {
    private items: string[] = [];
    private index = -1;
    private savedDraft = "";

    push(text: string) {
        if (!text || this.items[this.items.length - 1] === text) {
            return;
        }
        this.items.push(text);
        if (this.items.length > 50) {
            this.items.shift();
        }
        this.index = -1;
    }

    get(): string[] {
        return this.items.slice();
    }

    clear() {
        this.items = [];
        this.index = -1;
    }

    restore(history: string[]) {
        this.items = history.slice(-50);
        this.index = -1;
    }

    has(): boolean {
        return this.items.length > 0;
    }

    isBrowsing(): boolean {
        return this.index !== -1;
    }

    resetCursor() {
        this.index = -1;
        this.savedDraft = "";
    }

    beginBrowsing(currentDraft: string): string {
        this.savedDraft = currentDraft;
        this.index = this.items.length - 1;
        return this.items[this.index];
    }

    navigateUp(): string {
        if (this.index > 0) {
            this.index--;
        }
        return this.items[this.index];
    }

    navigateDown(): string {
        this.index++;
        if (this.index >= this.items.length) {
            const draft = this.savedDraft;
            this.resetCursor();
            return draft;
        }
        return this.items[this.index];
    }
}
