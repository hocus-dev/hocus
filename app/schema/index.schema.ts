import { z } from "zod";

export const ActionFormSchema = z.object({
  fname: z.string().min(1),
});
