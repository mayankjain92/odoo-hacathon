export const Role = {
  Admin: "Admin",
  AssetManager: "AssetManager",
  DepartmentHead: "DepartmentHead",
  Employee: "Employee",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const AssetStatus = {
  Available: "Available",
  Allocated: "Allocated",
  Reserved: "Reserved",
  UnderMaintenance: "UnderMaintenance",
  Lost: "Lost",
  Retired: "Retired",
  Disposed: "Disposed",
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const BookingStatus = {
  Upcoming: "Upcoming",
  Ongoing: "Ongoing",
  Completed: "Completed",
  Cancelled: "Cancelled",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const TransferStatus = {
  Requested: "Requested",
  Approved: "Approved",
  Rejected: "Rejected",
} as const;
export type TransferStatus = (typeof TransferStatus)[keyof typeof TransferStatus];

export const MaintenanceStatus = {
  Pending: "Pending",
  Approved: "Approved",
  Rejected: "Rejected",
  TechnicianAssigned: "TechnicianAssigned",
  InProgress: "InProgress",
  Resolved: "Resolved",
} as const;
export type MaintenanceStatus =
  (typeof MaintenanceStatus)[keyof typeof MaintenanceStatus];

export const MaintenancePriority = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
  Critical: "Critical",
} as const;
export type MaintenancePriority =
  (typeof MaintenancePriority)[keyof typeof MaintenancePriority];

export const AuditItemResult = {
  Verified: "Verified",
  Missing: "Missing",
  Damaged: "Damaged",
} as const;
export type AuditItemResult =
  (typeof AuditItemResult)[keyof typeof AuditItemResult];

export const AuditCycleStatus = {
  Open: "Open",
  InProgress: "InProgress",
  Closed: "Closed",
} as const;
export type AuditCycleStatus =
  (typeof AuditCycleStatus)[keyof typeof AuditCycleStatus];

export const EntityStatus = {
  Active: "Active",
  Inactive: "Inactive",
} as const;
export type EntityStatus = (typeof EntityStatus)[keyof typeof EntityStatus];

export const ErrorCode = {
  ASSET_ALREADY_ALLOCATED: "ASSET_ALREADY_ALLOCATED",
  BOOKING_OVERLAP: "BOOKING_OVERLAP",
  FORBIDDEN_ROLE: "FORBIDDEN_ROLE",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
