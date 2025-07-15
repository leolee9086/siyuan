export const editDialogContent = (language: { [key: string]: string }) => {
    return `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" placeholder="${language.memo}">
    <div class="fn__hr"></div>
    <textarea class="b3-text-field fn__block" placeholder="${language.aiCustomAction}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--remove">${language.delete}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--cancel">${language.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${language.confirm}</button>
</div>`
}

export const customDialogContent = (language: { [key: string]: string }) => {
    return `<div class="b3-dialog__content">
    <input class="b3-text-field fn__block" value="" placeholder="${language.memo}">
    <div class="fn__hr"></div>
    <textarea class="b3-text-field fn__block" placeholder="${language.aiCustomAction}"></textarea>
</div>
<div class="b3-dialog__action">
    <button class="b3-button b3-button--cancel">${language.cancel}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${language.use}</button><div class="fn__space"></div>
    <button class="b3-button b3-button--text">${language.save}</button>
</div>`
}