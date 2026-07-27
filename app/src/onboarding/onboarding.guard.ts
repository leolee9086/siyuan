/** 获取已初始化的引导语言环境；引导只在应用配置与语言包加载完成后挂载。 */
export const getOnboardingLanguages = () => {
    const languages = window.siyuan.languages;
    if (!languages) {
        throw new TypeError("Onboarding languages are unavailable");
    }
    return languages;
};
