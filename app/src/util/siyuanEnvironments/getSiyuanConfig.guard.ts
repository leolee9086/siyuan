import { layoutLayoutSchema } from "../../config/configSchemas/uiLayout.schema";
type SiyuanLayout = NonNullable<NonNullable<typeof window.siyuan>["layout"]>;

/**
 * @AIDONE
 * @param layout 
 * @returns 
 */
export const isCenterLayout = (layout: unknown): layout is NonNullable<SiyuanLayout["centerLayout"]> => {
    return layoutLayoutSchema.safeParse(layout).success;
};
