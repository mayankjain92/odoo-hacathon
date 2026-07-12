import { Injectable, HttpStatus } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ApiException } from "../common/errors/api.exception";
import { ErrorCode, AssetStatus, EntityStatus, TransferStatus, Role, NotificationType } from "@assetflow/shared";
import { AllocateAssetDto } from "./dto/allocate-asset.dto";
import { ReturnAssetDto } from "./dto/return-asset.dto";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { ResolveTransferDto } from "./dto/resolve-transfer.dto";
import { AllocationsQueryDto } from "./dto/allocations-query.dto";

@Injectable()
export class AllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async allocateAsset(
    dto: AllocateAssetDto,
    actorId: string,
    actorRole: string,
    actorDeptId: string | null,
  ) {
    // 1. Fetch asset with category and active allocations
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: {
        category: true,
        allocations: {
          where: { active: true },
          include: {
            employee: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // 2. Conflict Check: already allocated
    if (asset.status === AssetStatus.Allocated || asset.allocations.length > 0) {
      const activeAlloc = asset.allocations[0];
      const holder = activeAlloc
        ? {
            id: activeAlloc.employee?.id || activeAlloc.department?.id,
            name: activeAlloc.employee?.name || activeAlloc.department?.name,
            email: activeAlloc.employee?.email || null,
            type: activeAlloc.employee ? "employee" : "department",
          }
        : null;

      throw new ApiException(
        ErrorCode.ASSET_ALREADY_ALLOCATED,
        "Asset is already allocated to another holder",
        HttpStatus.CONFLICT,
        {
          holder,
          allocatedAt: activeAlloc?.allocatedAt || null,
        },
      );
    }

    // 3. Validation Check: Lifecycle states other than Available are blocked
    if (asset.status !== AssetStatus.Available) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        `Asset is not available for allocation (Current status: ${asset.status})`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Validate targets: Employee or Department
    let targetEmployeeDeptId: string | null = null;
    if (dto.employeeId) {
      const employee = await this.prisma.user.findUnique({
        where: { id: dto.employeeId },
      });
      if (!employee || employee.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Target employee not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
      targetEmployeeDeptId = employee.departmentId;
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept || dept.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Target department not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // 5. Enforce RBAC constraints
    if (actorRole === Role.Employee) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "Employees are not authorized to allocate assets",
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorRole === Role.DepartmentHead) {
      // Department Head can only allocate assets belonging to their department
      // AND to targets inside their department
      const assetBelongsToDept = asset.departmentId === actorDeptId;
      const targetInDept =
        (dto.departmentId && dto.departmentId === actorDeptId) ||
        (dto.employeeId && targetEmployeeDeptId === actorDeptId);

      if (!assetBelongsToDept || !targetInDept) {
        throw new ApiException(
          ErrorCode.FORBIDDEN_ROLE,
          "Department heads can only allocate assets belonging to their department to employees of their department",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // 6. Database Transaction — a per-asset advisory lock plus a re-check inside
    //    the transaction ensures two concurrent allocations of the same asset
    //    cannot both pass the availability check (TOCTOU). The outer check above
    //    stays for the fast path and its richer "already allocated" error.
    return this.prisma.$transaction(async (tx) => {
      // $executeRaw: pg_advisory_xact_lock returns void; $queryRaw cannot deserialize it (P2010).
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.assetId}))`;

      const [fresh, activeCount] = await Promise.all([
        tx.asset.findUnique({ where: { id: dto.assetId }, select: { status: true } }),
        tx.allocation.count({ where: { assetId: dto.assetId, active: true } }),
      ]);

      if (!fresh || fresh.status !== AssetStatus.Available || activeCount > 0) {
        throw new ApiException(
          ErrorCode.ASSET_ALREADY_ALLOCATED,
          "Asset is no longer available for allocation",
          HttpStatus.CONFLICT,
        );
      }

      // Create allocation record
      const allocation = await tx.allocation.create({
        data: {
          assetId: dto.assetId,
          employeeId: dto.employeeId || null,
          departmentId: dto.departmentId || null,
          expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : null,
          returnedAt: null,
          returnNotes: null,
          isOverdue: false,
          active: true,
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
          asset: { select: { id: true, name: true, assetTag: true } },
        },
      });

      // Update Asset status
      await tx.asset.update({
        where: { id: dto.assetId },
        data: {
          status: AssetStatus.Allocated,
          // Set asset's department to the allocation target's department
          departmentId: dto.departmentId || targetEmployeeDeptId || undefined,
        },
      });

      // Log Activity
      await tx.activityLog.create({
        data: {
          actorId,
          action: "allocation.create",
          entityType: "Allocation",
          entityId: allocation.id,
          metadata: {
            assetId: dto.assetId,
            employeeId: dto.employeeId || null,
            departmentId: dto.departmentId || null,
          },
        },
      });

      // Notify the employee the asset was assigned to them
      if (dto.employeeId) {
        await tx.notification.create({
          data: {
            userId: dto.employeeId,
            title: "Asset Assigned",
            body: `"${allocation.asset.name}" (${allocation.asset.assetTag}) has been allocated to you.`,
            type: NotificationType.AssetAssigned,
          },
        });
      }

      return allocation;
    });
  }

  async returnAsset(
    allocationId: string,
    dto: ReturnAssetDto,
    actorId: string,
    actorRole: string,
    actorDeptId: string | null,
  ) {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id: allocationId },
      include: {
        employee: { select: { id: true, departmentId: true } },
        asset: true,
      },
    });

    if (!allocation || !allocation.active) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Active allocation not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // RBAC validation
    if (actorRole === Role.Employee) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "Employees cannot approve returns",
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorRole === Role.DepartmentHead) {
      // Must match department
      const isFromDept =
        allocation.departmentId === actorDeptId ||
        allocation.employee?.departmentId === actorDeptId ||
        allocation.asset.departmentId === actorDeptId;

      if (!isFromDept) {
        throw new ApiException(
          ErrorCode.FORBIDDEN_ROLE,
          "Department heads can only process returns for assets within their own department",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark allocation as inactive and returned
      const updated = await tx.allocation.update({
        where: { id: allocationId },
        data: {
          active: false,
          returnedAt: new Date(),
          returnNotes: dto.returnNotes || null,
        },
      });

      // Reset asset status to Available
      await tx.asset.update({
        where: { id: allocation.assetId },
        data: {
          status: AssetStatus.Available,
        },
      });

      // Log Activity
      await tx.activityLog.create({
        data: {
          actorId,
          action: "allocation.return",
          entityType: "Allocation",
          entityId: allocationId,
          metadata: {
            assetId: allocation.assetId,
            returnNotes: dto.returnNotes || null,
          },
        },
      });

      return updated;
    });
  }

  async returnAssetByAssetId(
    assetId: string,
    dto: ReturnAssetDto,
    actorId: string,
    actorRole: string,
    actorDeptId: string | null,
  ) {
    const activeAlloc = await this.prisma.allocation.findFirst({
      where: { assetId, active: true },
    });

    if (!activeAlloc) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "No active allocation found for this asset",
        HttpStatus.NOT_FOUND,
      );
    }

    return this.returnAsset(activeAlloc.id, dto, actorId, actorRole, actorDeptId);
  }

  async findAll(query: AllocationsQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.assetId) {
      where.assetId = query.assetId;
    }
    if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.status === "active") {
      where.active = true;
    } else if (query.status === "returned") {
      where.active = false;
    } else if (query.status === "overdue") {
      where.active = true;
      where.isOverdue = true;
    }

    const [data, total] = await Promise.all([
      this.prisma.allocation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { allocatedAt: "desc" },
        include: {
          asset: { select: { id: true, name: true, assetTag: true } },
          employee: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.allocation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: string) {
    const allocation = await this.prisma.allocation.findUnique({
      where: { id },
      include: {
        asset: true,
        employee: { select: { id: true, name: true, email: true, departmentId: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!allocation) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Allocation not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return allocation;
  }

  // ==========================================
  // TRANSFERS
  // ==========================================

  async createTransferRequest(dto: CreateTransferDto, requesterId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id: dto.assetId },
      include: {
        allocations: { where: { active: true } },
      },
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // Transfers should ideally target allocated assets
    if (asset.allocations.length === 0) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Asset is not currently allocated. Allocate it directly.",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify target exists
    if (dto.toEmployeeId) {
      const employee = await this.prisma.user.findUnique({ where: { id: dto.toEmployeeId } });
      if (!employee || employee.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Target employee not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (dto.toDepartmentId) {
      const dept = await this.prisma.department.findUnique({ where: { id: dto.toDepartmentId } });
      if (!dept || dept.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Target department not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const transfer = await this.prisma.transferRequest.create({
      data: {
        assetId: dto.assetId,
        requesterId,
        toEmployeeId: dto.toEmployeeId || null,
        toDepartmentId: dto.toDepartmentId || null,
        status: TransferStatus.Requested,
        notes: dto.notes || null,
      },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    await this.prisma.activityLog.create({
      data: {
        actorId: requesterId,
        action: "transfer.request",
        entityType: "TransferRequest",
        entityId: transfer.id,
        metadata: {
          assetId: dto.assetId,
          toEmployeeId: dto.toEmployeeId || null,
          toDepartmentId: dto.toDepartmentId || null,
        },
      },
    });

    return transfer;
  }

  async resolveTransferRequest(
    requestId: string,
    dto: ResolveTransferDto,
    actorId: string,
    actorRole: string,
    actorDeptId: string | null,
  ) {
    const request = await this.prisma.transferRequest.findUnique({
      where: { id: requestId },
      include: {
        asset: {
          include: {
            allocations: { where: { active: true } },
          },
        },
        requester: true,
      },
    });

    if (!request || request.status !== TransferStatus.Requested) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Pending transfer request not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // RBAC validation
    if (actorRole === Role.Employee) {
      throw new ApiException(
        ErrorCode.FORBIDDEN_ROLE,
        "Employees cannot resolve transfers",
        HttpStatus.FORBIDDEN,
      );
    }

    if (actorRole === Role.DepartmentHead) {
      // Department Head can only resolve transfers from or to their department
      const currentHolderDeptId = request.asset.departmentId;
      let targetDeptId = request.toDepartmentId;

      if (request.toEmployeeId && !targetDeptId) {
        const targetEmployee = await this.prisma.user.findUnique({
          where: { id: request.toEmployeeId },
          select: { departmentId: true },
        });
        targetDeptId = targetEmployee?.departmentId || null;
      }

      const isFromDept = currentHolderDeptId === actorDeptId;
      const isToDept = targetDeptId === actorDeptId;

      if (!isFromDept && !isToDept) {
        throw new ApiException(
          ErrorCode.FORBIDDEN_ROLE,
          "Department heads can only resolve transfers concerning their own department",
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Update transfer request status
      const updatedRequest = await tx.transferRequest.update({
        where: { id: requestId },
        data: {
          status: dto.status,
          approverId: actorId,
          notes: dto.notes || null,
        },
      });

      if (dto.status === TransferStatus.Approved) {
        // Close previous active allocation
        const activeAlloc = request.asset.allocations[0];
        if (activeAlloc) {
          await tx.allocation.update({
            where: { id: activeAlloc.id },
            data: {
              active: false,
              returnedAt: new Date(),
              returnNotes: `Transferred to new holder (Approved by: ${actorId})`,
            },
          });
        }

        // Determine target department
        let targetDeptId = request.toDepartmentId;
        if (request.toEmployeeId && !targetDeptId) {
          const targetEmployee = await tx.user.findUnique({
            where: { id: request.toEmployeeId },
            select: { departmentId: true },
          });
          targetDeptId = targetEmployee?.departmentId || null;
        }

        // Create new allocation
        await tx.allocation.create({
          data: {
            assetId: request.assetId,
            employeeId: request.toEmployeeId || null,
            departmentId: request.toDepartmentId || null,
            expectedReturnAt: null,
            returnedAt: null,
            returnNotes: null,
            isOverdue: false,
            active: true,
          },
        });

        // Update Asset department and status
        await tx.asset.update({
          where: { id: request.assetId },
          data: {
            status: AssetStatus.Allocated,
            departmentId: targetDeptId || undefined,
          },
        });

        await tx.activityLog.create({
          data: {
            actorId,
            action: "transfer.approve",
            entityType: "TransferRequest",
            entityId: requestId,
            metadata: {
              assetId: request.assetId,
              toEmployeeId: request.toEmployeeId,
              toDepartmentId: request.toDepartmentId,
            },
          },
        });

        // Notify the requester their transfer was approved
        await tx.notification.create({
          data: {
            userId: request.requesterId,
            title: "Transfer Approved",
            body: `Your transfer request for "${request.asset.name}" (${request.asset.assetTag}) was approved.`,
            type: NotificationType.TransferRequest,
          },
        });

        // Notify the new holder the asset was assigned to them
        if (request.toEmployeeId) {
          await tx.notification.create({
            data: {
              userId: request.toEmployeeId,
              title: "Asset Assigned",
              body: `"${request.asset.name}" (${request.asset.assetTag}) has been transferred to you.`,
              type: NotificationType.AssetAssigned,
            },
          });
        }
      } else {
        await tx.activityLog.create({
          data: {
            actorId,
            action: "transfer.reject",
            entityType: "TransferRequest",
            entityId: requestId,
            metadata: {
              reason: dto.notes || null,
            },
          },
        });

        // Notify the requester their transfer was rejected
        await tx.notification.create({
          data: {
            userId: request.requesterId,
            title: "Transfer Rejected",
            body: `Your transfer request for "${request.asset.name}" (${request.asset.assetTag}) was rejected.`,
            type: NotificationType.TransferRequest,
          },
        });
      }

      return updatedRequest;
    });
  }

  async findAllTransferRequests(status?: TransferStatus) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    return this.prisma.transferRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        asset: { select: { id: true, name: true, assetTag: true } },
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ==========================================
  // OVERDUE CRON/JOB METHOD
  // ==========================================

  async scanOverdueAllocations() {
    const now = new Date();

    // Find active allocations past expectedReturnAt that are not yet marked as overdue
    const overdueList = await this.prisma.allocation.findMany({
      where: {
        active: true,
        isOverdue: false,
        expectedReturnAt: {
          lt: now,
        },
      },
      include: {
        employee: true,
        asset: true,
      },
    });

    if (overdueList.length === 0) {
      return { count: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark them as overdue
      const ids = overdueList.map((a) => a.id);
      await tx.allocation.updateMany({
        where: { id: { in: ids } },
        data: { isOverdue: true },
      });

      // Emit notifications for employees
      for (const alloc of overdueList) {
        if (alloc.employeeId && alloc.employee) {
          await tx.notification.create({
            data: {
              userId: alloc.employeeId,
              title: "Asset Allocation Overdue",
              body: `The asset "${alloc.asset.name}" (Tag: ${alloc.asset.assetTag}) was expected to be returned by ${alloc.expectedReturnAt?.toLocaleDateString()}. Please return it or contact management.`,
              type: "Overdue",
            },
          });
        }
      }

      await tx.activityLog.create({
        data: {
          action: "system.overdue_scan",
          entityType: "Allocation",
          metadata: {
            scannedCount: overdueList.length,
            markedOverdueIds: ids,
          },
        },
      });

      return { count: overdueList.length };
    });
  }
}
