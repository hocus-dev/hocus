import { z } from "zod";

export const ParamsProviderSchema = z.enum(["google"] as const);
