import { z } from "zod";
import { ErrorCode } from "./enums.js";

const errorCodeValues = Object.values(ErrorCode) as [ErrorCode, ...ErrorCode[]];

export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  code: z.enum(errorCodeValues),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
