import z from "zod";

export const buildKeymapEntrySchema = () => z.object({
    custom: z.string(),
    default: z.string()
});