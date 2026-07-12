import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { FileInterceptor, FilesInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Role } from "@assetflow/shared";
import {
  CurrentUser,
  JwtAuthGuard,
  Roles,
  RolesGuard,
} from "../auth";
import type { AuthUserView } from "../auth/types/auth.types";
import { AssetsService } from "./assets.service";
import { AssetListQueryDto } from "./dto/asset-list-query.dto";
import { CreateAssetDto } from "./dto/create-asset.dto";
import { UpdateAssetDto } from "./dto/update-asset.dto";
import { UpdateAssetStatusDto } from "./dto/update-asset-status.dto";

@ApiTags("assets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Register a new asset (auto tag AF-####)" })
  create(
    @Body() dto: CreateAssetDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.assetsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: "Search/list assets with filters and pagination",
  })
  findAll(@Query() query: AssetListQueryDto) {
    return this.assetsService.findAll(query);
  }

  @Get("tag/:assetTag")
  @ApiOperation({ summary: "Lookup asset by tag (QR / label)" })
  findByTag(@Param("assetTag") assetTag: string) {
    return this.assetsService.findByTag(assetTag);
  }

  @Get("serial/:serialNumber")
  @ApiOperation({ summary: "Lookup asset by serial number" })
  findBySerial(@Param("serialNumber") serialNumber: string) {
    return this.assetsService.findBySerial(serialNumber);
  }

  @Get(":id/history")
  @ApiOperation({
    summary: "Allocation, maintenance, and transfer history for an asset",
  })
  getHistory(@Param("id") id: string) {
    return this.assetsService.getHistory(id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get asset by id" })
  findOne(@Param("id") id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(":id")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Update asset metadata" })
  update(
    @Param("id") id: string,
    @Body() dto: UpdateAssetDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.assetsService.update(id, dto, user.id);
  }

  @Patch(":id/status")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({
    summary:
      "Manual lifecycle update (Lost / Retired / Disposed). Operational statuses are owned by other modules.",
  })
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateAssetStatusDto,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.assetsService.updateStatus(id, dto, user.id);
  }

  @Post(":id/photo")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Upload asset photo to Cloudinary" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        photo: { type: "string", format: "binary" },
      },
      required: ["photo"],
    },
  })
  @UseInterceptors(
    FileInterceptor("photo", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadPhoto(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.assetsService.uploadPhoto(id, file, user.id);
  }

  @Post(":id/documents")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({ summary: "Upload asset documents to Cloudinary" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        documents: {
          type: "array",
          items: { type: "string", format: "binary" },
        },
      },
      required: ["documents"],
    },
  })
  @UseInterceptors(
    FilesInterceptor("documents", 10, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadDocuments(
    @Param("id") id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUserView,
  ) {
    return this.assetsService.uploadDocuments(id, files, user.id);
  }

  @Delete(":id/documents")
  @Roles(Role.Admin, Role.AssetManager)
  @ApiOperation({
    summary: "Remove a document by Cloudinary publicId (?publicId=...)",
  })
  removeDocument(
    @Param("id") id: string,
    @Query("publicId") publicId: string,
    @CurrentUser() user: AuthUserView,
  ) {
    return this.assetsService.removeDocument(id, publicId, user.id);
  }
}
