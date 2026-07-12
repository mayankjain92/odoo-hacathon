import { HttpStatus, Injectable } from "@nestjs/common";
import {
  AssetStatus,
  ErrorCode,
  buildPaginationMeta,
  type PaginatedResponse,
} from "@assetflow/shared";
import { Prisma } from "../generated/prisma/client";
import { ApiException } from "../common/errors/api.exception";
import { CloudinaryService } from "../common/cloudinary/cloudinary.service";
import type { AssetDocumentMeta } from "../common/cloudinary/cloudinary.types";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAssetDto } from "./dto/create-asset.dto";
import type { UpdateAssetDto } from "./dto/update-asset.dto";
import type { UpdateAssetStatusDto } from "./dto/update-asset-status.dto";
import type { AssetListQueryDto } from "./dto/asset-list-query.dto";

const assetInclude = {
  category: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
} satisfies Prisma.AssetInclude;

type AssetWithRelations = Prisma.AssetGetPayload<{ include: typeof assetInclude }>;

/** Manual status changes owned by assets module (not allocation/booking/maintenance). */
const MANUAL_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  [AssetStatus.Available]: [
    AssetStatus.Lost,
    AssetStatus.Retired,
    AssetStatus.Disposed,
  ],
  [AssetStatus.Lost]: [AssetStatus.Available, AssetStatus.Disposed],
  [AssetStatus.Retired]: [AssetStatus.Available, AssetStatus.Disposed],
  [AssetStatus.Disposed]: [],
};

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const DOC_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async create(dto: CreateAssetDto, actorId: string) {
    await this.ensureCategory(dto.categoryId);
    if (dto.departmentId) {
      await this.ensureDepartment(dto.departmentId);
    }

    if (dto.serialNumber) {
      const duplicate = await this.prisma.asset.findFirst({
        where: { serialNumber: dto.serialNumber },
      });
      if (duplicate) {
        throw new ApiException(
          ErrorCode.CONFLICT,
          "An asset with this serial number already exists",
          HttpStatus.CONFLICT,
          { assetId: duplicate.id, assetTag: duplicate.assetTag },
        );
      }
    }

    const asset = await this.prisma.$transaction(async (tx) => {
      const assetTag = await this.nextAssetTag(tx);

      return tx.asset.create({
        data: {
          name: dto.name.trim(),
          assetTag,
          categoryId: dto.categoryId,
          serialNumber: dto.serialNumber?.trim() || null,
          acquisitionDate: new Date(dto.acquisitionDate),
          acquisitionCost:
            dto.acquisitionCost !== undefined
              ? new Prisma.Decimal(dto.acquisitionCost)
              : null,
          condition: dto.condition?.trim() || null,
          location: dto.location?.trim() || null,
          isSharedBookable: dto.isSharedBookable ?? false,
          departmentId: dto.departmentId ?? null,
          photoUrl: dto.photoUrl ?? null,
          metadata: dto.metadata ? (dto.metadata as any) : null,
          status: AssetStatus.Available,
        },
        include: assetInclude,
      });
    });

    await this.logActivity(actorId, "asset.register", "Asset", asset.id, {
      assetTag: asset.assetTag,
    });

    return this.toAssetView(asset);
  }

  async findAll(
    query: AssetListQueryDto,
  ): Promise<PaginatedResponse<ReturnType<AssetsService["toAssetView"]>>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.asset.count({ where }),
      this.prisma.asset.findMany({
        where,
        include: assetInclude,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      data: rows.map((row) => this.toAssetView(row)),
      meta: buildPaginationMeta(page, pageSize, total),
    };
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: assetInclude,
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found",
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toAssetView(asset);
  }

  async findByTag(assetTag: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { assetTag: assetTag.trim().toUpperCase() },
      include: assetInclude,
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found for tag",
        HttpStatus.NOT_FOUND,
        { assetTag },
      );
    }

    return this.toAssetView(asset);
  }

  async findBySerial(serialNumber: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { serialNumber: serialNumber.trim() },
      include: assetInclude,
    });

    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found for serial number",
        HttpStatus.NOT_FOUND,
        { serialNumber },
      );
    }

    return this.toAssetView(asset);
  }

  async update(id: string, dto: UpdateAssetDto, actorId: string) {
    const existing = await this.requireAsset(id);

    if (dto.categoryId) {
      await this.ensureCategory(dto.categoryId);
    }
    if (dto.departmentId) {
      await this.ensureDepartment(dto.departmentId);
    }

    if (dto.serialNumber) {
      const duplicate = await this.prisma.asset.findFirst({
        where: {
          serialNumber: dto.serialNumber,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ApiException(
          ErrorCode.CONFLICT,
          "An asset with this serial number already exists",
          HttpStatus.CONFLICT,
          { assetId: duplicate.id, assetTag: duplicate.assetTag },
        );
      }
    }

    const data: Prisma.AssetUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.categoryId !== undefined) {
      data.category = { connect: { id: dto.categoryId } };
    }
    if (dto.serialNumber !== undefined) {
      data.serialNumber = dto.serialNumber?.trim() || null;
    }
    if (dto.acquisitionDate !== undefined) {
      data.acquisitionDate = new Date(dto.acquisitionDate);
    }
    if (dto.acquisitionCost !== undefined) {
      data.acquisitionCost =
        dto.acquisitionCost === null
          ? null
          : new Prisma.Decimal(dto.acquisitionCost);
    }
    if (dto.condition !== undefined) {
      data.condition = dto.condition?.trim() || null;
    }
    if (dto.location !== undefined) {
      data.location = dto.location?.trim() || null;
    }
    if (dto.isSharedBookable !== undefined) {
      data.isSharedBookable = dto.isSharedBookable;
    }
    if (dto.departmentId !== undefined) {
      data.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }
    if (dto.photoUrl !== undefined) {
      data.photoUrl = dto.photoUrl;
    }
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as any;
    }

    const asset = await this.prisma.asset.update({
      where: { id: existing.id },
      data,
      include: assetInclude,
    });

    await this.logActivity(actorId, "asset.update", "Asset", asset.id);

    return this.toAssetView(asset);
  }

  async updateStatus(id: string, dto: UpdateAssetStatusDto, actorId: string) {
    const existing = await this.requireAsset(id);
    const from = existing.status;
    const to = dto.status;

    if (from === to) {
      return this.toAssetView(
        await this.prisma.asset.findUniqueOrThrow({
          where: { id },
          include: assetInclude,
        }),
      );
    }

    // Operational statuses are owned by allocations / bookings / maintenance.
    const operational: ReadonlySet<string> = new Set([
      AssetStatus.Allocated,
      AssetStatus.Reserved,
      AssetStatus.UnderMaintenance,
    ]);

    if (operational.has(to)) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Status ${to} must be set by the allocation, booking, or maintenance workflow`,
        HttpStatus.CONFLICT,
        { from, to },
      );
    }

    if (operational.has(from)) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Cannot manually change status while asset is ${from}`,
        HttpStatus.CONFLICT,
        { from, to },
      );
    }

    const allowed = MANUAL_STATUS_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ApiException(
        ErrorCode.INVALID_STATUS_TRANSITION,
        `Cannot transition asset from ${from} to ${to}`,
        HttpStatus.CONFLICT,
        { from, to, allowed },
      );
    }

    const asset = await this.prisma.asset.update({
      where: { id },
      data: { status: to },
      include: assetInclude,
    });

    await this.logActivity(actorId, "asset.status_change", "Asset", asset.id, {
      from,
      to,
      reason: dto.reason,
    });

    return this.toAssetView(asset);
  }

  async getHistory(id: string) {
    await this.requireAsset(id);

    const [allocations, maintenance, transfers] = await Promise.all([
      this.prisma.allocation.findMany({
        where: { assetId: id },
        orderBy: { allocatedAt: "desc" },
        include: {
          employee: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
        },
      }),
      this.prisma.maintenanceRequest.findMany({
        where: { assetId: id },
        orderBy: { createdAt: "desc" },
        include: {
          requester: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.transferRequest.findMany({
        where: { assetId: id },
        orderBy: { createdAt: "desc" },
        include: {
          requester: { select: { id: true, name: true, email: true } },
          approver: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      assetId: id,
      allocations,
      maintenance,
      transfers,
    };
  }

  async uploadPhoto(id: string, file: Express.Multer.File, actorId: string) {
    if (!file) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Photo file is required (field name: photo)",
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!IMAGE_MIME.has(file.mimetype)) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Photo must be jpeg, png, webp, or gif",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.requireAsset(id);
    const uploaded = await this.cloudinary.uploadImage(
      file,
      `assets/${existing.assetTag}/photos`,
    );

    if (existing.photoPublicId) {
      try {
        await this.cloudinary.destroy(existing.photoPublicId, "image");
      } catch {
        // Best-effort cleanup of previous Cloudinary asset
      }
    }

    const asset = await this.prisma.asset.update({
      where: { id },
      data: {
        photoUrl: uploaded.secureUrl,
        photoPublicId: uploaded.publicId,
      },
      include: assetInclude,
    });

    await this.logActivity(actorId, "asset.photo_upload", "Asset", asset.id, {
      publicId: uploaded.publicId,
    });

    return this.toAssetView(asset);
  }

  async uploadDocuments(
    id: string,
    files: Express.Multer.File[],
    actorId: string,
  ) {
    if (!files?.length) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "At least one document is required (field name: documents)",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.requireAsset(id);
    const currentDocs = this.parseDocuments(existing.documents);

    for (const file of files) {
      if (!DOC_MIME.has(file.mimetype)) {
        throw new ApiException(
          ErrorCode.VALIDATION_ERROR,
          `Unsupported document type: ${file.mimetype}`,
          HttpStatus.BAD_REQUEST,
          { filename: file.originalname },
        );
      }
    }

    const uploadedDocs: AssetDocumentMeta[] = [];
    for (const file of files) {
      const uploaded = await this.cloudinary.uploadDocument(
        file,
        `assets/${existing.assetTag}/documents`,
      );
      uploadedDocs.push({
        publicId: uploaded.publicId,
        url: uploaded.secureUrl,
        originalName: file.originalname,
        format: uploaded.format,
        bytes: uploaded.bytes,
        resourceType: uploaded.resourceType,
        uploadedAt: new Date().toISOString(),
      });
    }

    const documents = [...currentDocs, ...uploadedDocs];
    const asset = await this.prisma.asset.update({
      where: { id },
      data: { documents: documents as unknown as Prisma.InputJsonValue },
      include: assetInclude,
    });

    await this.logActivity(actorId, "asset.documents_upload", "Asset", asset.id, {
      count: uploadedDocs.length,
      publicIds: uploadedDocs.map((d) => d.publicId),
    });

    return this.toAssetView(asset);
  }

  async removeDocument(id: string, publicId: string, actorId: string) {
    if (!publicId?.trim()) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Query param publicId is required",
        HttpStatus.BAD_REQUEST,
      );
    }

    const existing = await this.requireAsset(id);
    const docs = this.parseDocuments(existing.documents);
    const target = docs.find((d) => d.publicId === publicId);

    if (!target) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Document not found on this asset",
        HttpStatus.NOT_FOUND,
        { publicId },
      );
    }

    try {
      await this.cloudinary.destroy(
        publicId,
        target.resourceType === "image" ? "image" : "raw",
      );
    } catch {
      // Continue removing DB reference even if remote delete fails
    }

    const documents = docs.filter((d) => d.publicId !== publicId);
    const asset = await this.prisma.asset.update({
      where: { id },
      data: { documents: documents as unknown as Prisma.InputJsonValue },
      include: assetInclude,
    });

    await this.logActivity(actorId, "asset.document_remove", "Asset", asset.id, {
      publicId,
    });

    return this.toAssetView(asset);
  }

  private parseDocuments(
    value: Prisma.JsonValue | null | undefined,
  ): AssetDocumentMeta[] {
    if (!value || !Array.isArray(value)) return [];
    return value as unknown as AssetDocumentMeta[];
  }

  private buildWhere(query: AssetListQueryDto): Prisma.AssetWhereInput {
    const where: Prisma.AssetWhereInput = {};

    if (query.status) where.status = query.status;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.location) {
      where.location = { contains: query.location, mode: "insensitive" };
    }
    if (query.assetTag) {
      where.assetTag = {
        equals: query.assetTag.trim().toUpperCase(),
      };
    }
    if (query.serialNumber) {
      where.serialNumber = {
        contains: query.serialNumber.trim(),
        mode: "insensitive",
      };
    }
    if (query.isSharedBookable !== undefined) {
      where.isSharedBookable = query.isSharedBookable;
    }

    if (query.q?.trim()) {
      const q = query.q.trim();
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { assetTag: { contains: q.toUpperCase(), mode: "insensitive" } },
        { serialNumber: { contains: q, mode: "insensitive" } },
        { location: { contains: q, mode: "insensitive" } },
      ];
    }

    return where;
  }

  private buildOrderBy(
    sort?: string,
  ): Prisma.AssetOrderByWithRelationInput {
    switch (sort) {
      case "name":
        return { name: "asc" };
      case "name:desc":
        return { name: "desc" };
      case "status":
        return { status: "asc" };
      case "acquisitionDate":
        return { acquisitionDate: "asc" };
      case "acquisitionDate:desc":
        return { acquisitionDate: "desc" };
      case "assetTag":
        return { assetTag: "asc" };
      default:
        return { createdAt: "desc" };
    }
  }

  private async nextAssetTag(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    await tx.assetTagSequence.upsert({
      where: { id: 1 },
      create: { id: 1, value: 0 },
      update: {},
    });

    const seq = await tx.assetTagSequence.update({
      where: { id: 1 },
      data: { value: { increment: 1 } },
    });

    return `AF-${String(seq.value).padStart(4, "0")}`;
  }

  private async requireAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset not found",
        HttpStatus.NOT_FOUND,
      );
    }
    return asset;
  }

  private async ensureCategory(categoryId: string) {
    const category = await this.prisma.assetCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Asset category not found",
        HttpStatus.NOT_FOUND,
        { categoryId },
      );
    }
  }

  private async ensureDepartment(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!department) {
      throw new ApiException(
        ErrorCode.NOT_FOUND,
        "Department not found",
        HttpStatus.NOT_FOUND,
        { departmentId },
      );
    }
  }

  private toAssetView(asset: AssetWithRelations) {
    return {
      id: asset.id,
      name: asset.name,
      assetTag: asset.assetTag,
      serialNumber: asset.serialNumber,
      status: asset.status,
      acquisitionDate: asset.acquisitionDate,
      acquisitionCost: asset.acquisitionCost
        ? Number(asset.acquisitionCost)
        : null,
      condition: asset.condition,
      location: asset.location,
      isSharedBookable: asset.isSharedBookable,
      photoUrl: asset.photoUrl,
      photoPublicId: asset.photoPublicId,
      documents: this.parseDocuments(asset.documents),
      metadata: asset.metadata as Record<string, any> | null,
      category: asset.category,
      department: asset.department,
      departmentId: asset.departmentId,
      categoryId: asset.categoryId,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      /** QR-friendly payload for scanners / labels */
      qrPayload: asset.assetTag,
    };
  }

  private async logActivity(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ) {
    await this.prisma.activityLog.create({
      data: {
        actorId,
        action,
        entityType,
        entityId,
        metadata: metadata
          ? (metadata as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }
}
