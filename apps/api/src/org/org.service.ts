import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorCode, Role, EntityStatus, buildPaginationMeta } from "@assetflow/shared";
import { ApiException } from "../common/errors/api.exception";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateDepartmentDto } from "./dto/create-department.dto";
import type { UpdateDepartmentDto } from "./dto/update-department.dto";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";
import type { UpdateEmployeeDto } from "./dto/update-employee.dto";
import type { OrgQueryDto } from "./dto/org-query.dto";

@Injectable()
export class OrgService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // DEPARTMENTS
  // ==========================================

  async createDepartment(dto: CreateDepartmentDto, actorId: string) {
    if (dto.parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent || parent.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Parent department not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (dto.headId) {
      const head = await this.prisma.user.findUnique({
        where: { id: dto.headId },
      });
      if (!head || head.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Department head employee not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const dept = await this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        parentId: dto.parentId || null,
        headId: dto.headId || null,
        status: dto.status || EntityStatus.Active,
      },
      include: {
        parent: { select: { id: true, name: true } },
        head: { select: { id: true, name: true, email: true } },
      },
    });

    await this.logActivity(actorId, "org.department.create", "Department", dept.id, { name: dept.name });
    return dept;
  }

  async findAllDepartments(query: OrgQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.departmentId) {
      where.parentId = query.departmentId;
    }

    if (query.q) {
      where.name = { contains: query.q, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        include: {
          parent: { select: { id: true, name: true } },
          head: { select: { id: true, name: true, email: true } },
          _count: { select: { users: true, assets: true } },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      data,
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async findDepartmentById(id: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        head: { select: { id: true, name: true, email: true } },
        children: {
          select: { id: true, name: true, status: true },
        },
      },
    });

    if (!dept) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Department not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return dept;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, actorId: string) {
    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Department not found",
        HttpStatus.NOT_FOUND,
      );
    }

    // Circular hierarchy check
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ApiException(
          ErrorCode.CONFLICT,
          "Circular hierarchy: department cannot be its own parent",
          HttpStatus.CONFLICT,
        );
      }

      let currentParentId: string | null = dto.parentId;
      while (currentParentId) {
        if (currentParentId === id) {
          throw new ApiException(
            ErrorCode.CONFLICT,
            "Circular hierarchy: parent department cannot be a descendant of this department",
            HttpStatus.CONFLICT,
          );
        }
        const res: { parentId: string | null } | null = await this.prisma.department.findUnique({
          where: { id: currentParentId },
          select: { parentId: true },
        });
        currentParentId = res?.parentId || null;
      }

      const parentExists = await this.prisma.department.findUnique({
        where: { id: dto.parentId },
      });
      if (!parentExists || parentExists.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Parent department not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (dto.headId) {
      const head = await this.prisma.user.findUnique({
        where: { id: dto.headId },
      });
      if (!head || head.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Department head employee not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        parentId: dto.parentId === null ? null : (dto.parentId || undefined),
        headId: dto.headId === null ? null : (dto.headId || undefined),
        status: dto.status || undefined,
      },
      include: {
        parent: { select: { id: true, name: true } },
        head: { select: { id: true, name: true, email: true } },
      },
    });

    await this.logActivity(actorId, "org.department.update", "Department", updated.id, {
      changes: dto,
    });
    return updated;
  }

  async deactivateDepartment(id: string, actorId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: { children: { where: { status: EntityStatus.Active } } },
    });

    if (!dept) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Department not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (dept.children.length > 0) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "Cannot deactivate department with active child departments",
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: { status: EntityStatus.Inactive },
    });

    await this.logActivity(actorId, "org.department.deactivate", "Department", id);
    return updated;
  }

  // ==========================================
  // ASSET CATEGORIES
  // ==========================================

  async createCategory(dto: CreateCategoryDto, actorId: string) {
    const existing = await this.prisma.assetCategory.findUnique({
      where: { name: dto.name.trim() },
    });

    if (existing) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "Asset category with this name already exists",
        HttpStatus.CONFLICT,
      );
    }

    const category = await this.prisma.assetCategory.create({
      data: {
        name: dto.name.trim(),
        description: dto.description || null,
        optionalFields: dto.optionalFields !== undefined ? (dto.optionalFields as any) : undefined,
      },
    });

    await this.logActivity(actorId, "org.category.create", "AssetCategory", category.id, {
      name: category.name,
    });
    return category;
  }

  async findAllCategories(query: OrgQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.assetCategory.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        include: { _count: { select: { assets: true } } },
      }),
      this.prisma.assetCategory.count({ where }),
    ]);

    return {
      data,
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async findCategoryById(id: string) {
    const category = await this.prisma.assetCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset category not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return category;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, actorId: string) {
    const category = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!category) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset category not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.name && dto.name.trim() !== category.name) {
      const existing = await this.prisma.assetCategory.findUnique({
        where: { name: dto.name.trim() },
      });
      if (existing) {
        throw new ApiException(
          ErrorCode.CONFLICT,
          "Asset category with this name already exists",
          HttpStatus.CONFLICT,
        );
      }
    }

    const updated = await this.prisma.assetCategory.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        optionalFields: dto.optionalFields !== undefined ? dto.optionalFields : undefined,
      },
    });

    await this.logActivity(actorId, "org.category.update", "AssetCategory", updated.id, {
      changes: dto,
    });
    return updated;
  }

  async deleteCategory(id: string, actorId: string) {
    const category = await this.prisma.assetCategory.findUnique({
      where: { id },
      include: { _count: { select: { assets: true } } },
    });

    if (!category) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset category not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (category._count.assets > 0) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "Cannot delete category with associated assets",
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.assetCategory.delete({ where: { id } });
    await this.logActivity(actorId, "org.category.delete", "AssetCategory", id);
    return { success: true };
  }

  // ==========================================
  // EMPLOYEES
  // ==========================================

  async findAllEmployees(query: OrgQueryDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: "insensitive" } },
        { email: { contains: query.q, mode: "insensitive" } },
      ];
    }

    const [rawUsers, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          departmentId: true,
          department: { select: { id: true, name: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: rawUsers,
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async findEmployeeById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        createdAt: true,
        updatedAt: true,
        headedDepartments: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Employee not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return user;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Employee not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept || dept.status !== EntityStatus.Active) {
        throw new ApiException(
          ErrorCode.NOT_FOUND,
          "Department not found or is inactive",
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        departmentId: dto.departmentId === null ? null : (dto.departmentId || undefined),
        status: dto.status || undefined,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        departmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logActivity(actorId, "org.employee.update", "User", updated.id, {
      changes: dto,
    });
    return updated;
  }

  async promoteEmployee(id: string, role: Role, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Employee not found",
        HttpStatus.NOT_FOUND,
      );
    }

    if (user.status !== EntityStatus.Active) {
      throw new ApiException(
        ErrorCode.CONFLICT,
        "Cannot promote inactive employee",
        HttpStatus.CONFLICT,
      );
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.logActivity(actorId, "org.employee.promote", "User", updated.id, {
      fromRole: user.role,
      toRole: role,
    });
    return updated;
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private async logActivity(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: any,
  ): Promise<void> {
    await this.prisma.activityLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata || null,
      },
    });
  }
}
