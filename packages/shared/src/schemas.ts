import { z } from "zod";
import {
  AssetStatus,
  AuditItemResult,
  BookingStatus,
  EntityStatus,
  MaintenancePriority,
  MaintenanceStatus,
  Role,
  TransferStatus,
} from "./enums";

function enumSchema<T extends string>(values: Record<string, T>) {
  const list = Object.values(values) as [T, ...T[]];
  return z.enum(list);
}

export const roleSchema = enumSchema(Role);
export const assetStatusSchema = enumSchema(AssetStatus);
export const bookingStatusSchema = enumSchema(BookingStatus);
export const transferStatusSchema = enumSchema(TransferStatus);
export const maintenanceStatusSchema = enumSchema(MaintenanceStatus);
export const maintenancePrioritySchema = enumSchema(MaintenancePriority);
export const entityStatusSchema = enumSchema(EntityStatus);
export const auditItemResultSchema = enumSchema(AuditItemResult);

export const signupSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().cuid().optional().nullable(),
  headId: z.string().cuid().optional().nullable(),
  status: entityStatusSchema.default(EntityStatus.Active),
});

export const createAssetCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  optionalFields: z.record(z.unknown()).optional(),
});

export const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  categoryId: z.string().cuid(),
  serialNumber: z.string().max(120).optional(),
  acquisitionDate: z.string().datetime().or(z.string().date()),
  acquisitionCost: z.number().nonnegative().optional(),
  condition: z.string().max(120).optional(),
  location: z.string().max(200).optional(),
  isSharedBookable: z.boolean().default(false),
  departmentId: z.string().cuid().optional().nullable(),
});

export const allocateAssetSchema = z.object({
  assetId: z.string().cuid(),
  employeeId: z.string().cuid().optional(),
  departmentId: z.string().cuid().optional(),
  expectedReturnAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional(),
});

export const createBookingSchema = z
  .object({
    assetId: z.string().cuid(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    purpose: z.string().max(500).optional(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const createMaintenanceSchema = z.object({
  assetId: z.string().cuid(),
  description: z.string().min(1).max(2000),
  priority: maintenancePrioritySchema.default(MaintenancePriority.Medium),
});

export const createTransferRequestSchema = z
  .object({
    assetId: z.string().cuid(),
    toEmployeeId: z.string().cuid().optional().nullable(),
    toDepartmentId: z.string().cuid().optional().nullable(),
    notes: z.string().max(1000).optional(),
  })
  .refine((v) => v.toEmployeeId || v.toDepartmentId, {
    message: "toEmployeeId or toDepartmentId is required",
    path: ["toEmployeeId"],
  });

export const resolveTransferSchema = z.object({
  status: z.enum([TransferStatus.Approved, TransferStatus.Rejected]),
  notes: z.string().max(1000).optional(),
});

export const createAuditCycleSchema = z
  .object({
    name: z.string().min(1).max(120),
    departmentId: z.string().cuid().optional().nullable(),
    location: z.string().max(200).optional(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    auditorIds: z.array(z.string().cuid()).default([]),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const recordAuditItemSchema = z.object({
  result: auditItemResultSchema,
  notes: z.string().max(1000).optional(),
});

export const reportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  departmentId: z.string().cuid().optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();
export const updateAssetCategorySchema = createAssetCategorySchema.partial();

export const updateUserSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  departmentId: z.string().cuid().optional().nullable(),
  status: entityStatusSchema.optional(),
});

export const promoteUserSchema = z.object({
  role: roleSchema,
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type UpdateAssetCategoryInput = z.infer<typeof updateAssetCategorySchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type PromoteUserInput = z.infer<typeof promoteUserSchema>;

export type AllocateAssetInput = z.infer<typeof allocateAssetSchema>;
export type CreateTransferRequestInput = z.infer<typeof createTransferRequestSchema>;
export type ResolveTransferInput = z.infer<typeof resolveTransferSchema>;
