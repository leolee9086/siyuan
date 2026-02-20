import {isMobile} from "../platform";

export const updateCardHV = () => {
    if (isMobile) {
        if (window.matchMedia("(orientation:portrait)").matches) {
            document.querySelectorAll(".card__action .card__icon").forEach(item => {
                item.classList.remove("fn__none");
            });
        } else {
            document.querySelectorAll(".card__action .card__icon").forEach(item => {
                item.classList.add("fn__none");
            });
        }
    }
};
