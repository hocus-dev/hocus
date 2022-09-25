import { z } from "zod";

export type OidcUser = z.infer<typeof OidcUserSchema>;
export const OidcUserSchema = z.object({
  sub: z.string(),
  email: z.string(),
});
