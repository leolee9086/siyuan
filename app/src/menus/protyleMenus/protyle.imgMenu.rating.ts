import { fetchPost } from "../../ai/imports";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * Update the visual display of stars based on rating.
 * @param stars The list of star elements
 * @param rating The rating value (0-5)
 */
const updateStarDisplay = (stars: NodeListOf<Element>, rating: number) => {
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (s instanceof HTMLElement) {
            if (i < rating) {
                s.classList.add("ft__primary");
                s.style.color = "var(--b3-theme-primary)";
            } else {
                s.classList.remove("ft__primary");
                s.style.color = "";
            }
        }
    }
};

/**
 * Generate HTML for asset rating.
 * @param src The asset path
 * @returns HTML string
 */
export const genRatingHTML = (src: string) => {
    if (!src.startsWith("assets/")) {
        return "";
    }
    return `<div class="fn__hr"></div><div class="fn__flex" id="asset-rating-container">
    <span class="fn__flex-center">Rating</span>
    <span class="fn__space"></span>
    <div class="fn__flex fn__flex-1">
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="1"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="2"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="3"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="4"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="block__icon block__icon--show b3-tooltips b3-tooltips__e star-icon" style="padding: 4px;" aria-label="5"><svg><use xlink:href="#iconStar"></use></svg></span>
        <span class="fn__space"></span>
        <span data-action="clear-rating" class="block__icon block__icon--show b3-tooltips b3-tooltips__e" aria-label="${siyuanI18n.clear || "Clear"}"><svg><use xlink:href="#iconTrashcan"></use></svg></span>
    </div>
</div>`;
};

/**
 * Bind events for asset rating.
 * @param element The container element
 * @param src The asset path
 */
export const bindRatingEvents = (element: Element, src: string) => {
    if (!src.startsWith("assets/")) {
        return;
    }
    const ratingContainer = element.querySelector("#asset-rating-container");
    if (!ratingContainer) {
        return;
    }

    const stars = ratingContainer.querySelectorAll(".star-icon");

    // Fetch current rating
    fetchPost("/api/s-forge/asset-meta/get", { path: src }, (response) => {
        if (response.code === 0 && response.data) {
            updateStarDisplay(stars, response.data.star || 0);
        }
    });

    // Bind click events
    for (let i = 0; i < stars.length; i++) {
        stars[i].addEventListener("click", () => {
            const newStar = i + 1;
            fetchPost("/api/s-forge/asset-meta/set", {
                path: src,
                star: newStar
            }, (response) => {
                if (response.code === 0) {
                    updateStarDisplay(stars, newStar);
                }
            });
        });
    }

    // Clear rating button
    const clearBtn = ratingContainer.querySelector("[data-action='clear-rating']");
    if (clearBtn) {
        clearBtn.addEventListener("click", () => {
            fetchPost("/api/s-forge/asset-meta/set", {
                path: src,
                star: 0
            }, (response) => {
                if (response.code === 0) {
                    updateStarDisplay(stars, 0);
                }
            });
        });
    }
};
