
export const downloadProgress = (data: { id: string; percent: number; }) => {
    const bazaarSideElement = document.querySelector("#configBazaarReadme .item__side");
    if (!bazaarSideElement) {
        return;
    }
    if (data.id !== JSON.parse(bazaarSideElement.getAttribute("data-obj")).repoURL) {
        return;
    }
    const btnElement = bazaarSideElement.querySelector('[data-type="install"]') as HTMLElement;
    if (btnElement) {
        if (data.percent >= 1) {
            btnElement.parentElement.classList.add("fn__none");
            btnElement.parentElement.nextElementSibling.classList.add("fn__none");
        } else {
            btnElement.classList.add("b3-button--progress");
            btnElement.parentElement.nextElementSibling.firstElementChild.classList.add("b3-button--progress");
            btnElement.innerHTML = `<span style="width: ${data.percent * 100}%"></span>`;
            btnElement.parentElement.nextElementSibling.firstElementChild.innerHTML = `<span style="width: ${data.percent * 100}%"></span>`;
        }
    }
};
