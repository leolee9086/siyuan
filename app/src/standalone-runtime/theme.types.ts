/** 独立入口解析后的主题选择。 */
export interface IStandaloneThemeSelection {
    dark: boolean;
    defaultTheme: "daylight" | "midnight";
    selectedTheme: string;
    themeVersion: string;
    lightTheme: string;
    darkTheme: string;
}
