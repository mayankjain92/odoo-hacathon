import { HttpStatus, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { Readable } from "stream";
import { ErrorCode } from "@assetflow/shared";
import { ApiException } from "../errors/api.exception";
import type { CloudinaryUploadResult } from "./cloudinary.types";

@Injectable()
export class CloudinaryService implements OnModuleInit {
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");

    if (
      cloudName &&
      apiKey &&
      apiSecret &&
      !cloudName.startsWith("your-") &&
      !apiKey.startsWith("your-") &&
      !apiSecret.startsWith("your-")
    ) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.configured = true;
    }
  }

  isReady() {
    return this.configured;
  }

  assertConfigured() {
    if (!this.configured) {
      throw new ApiException(
        ErrorCode.VALIDATION_ERROR,
        "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in apps/api/.env",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folderSuffix: string,
  ): Promise<CloudinaryUploadResult> {
    this.assertConfigured();
    return this.uploadBuffer(file, folderSuffix, "image");
  }

  async uploadDocument(
    file: Express.Multer.File,
    folderSuffix: string,
  ): Promise<CloudinaryUploadResult> {
    this.assertConfigured();
    // raw/auto covers PDFs and office docs on Cloudinary
    return this.uploadBuffer(file, folderSuffix, "auto");
  }

  async destroy(publicId: string, resourceType: string = "image") {
    this.assertConfigured();
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType === "image" ? "image" : "raw",
    });
  }

  private folderPath(suffix: string) {
    const root = this.config.get<string>("CLOUDINARY_FOLDER") ?? "assetflow";
    return `${root}/${suffix}`.replace(/\/+/g, "/");
  }

  private uploadBuffer(
    file: Express.Multer.File,
    folderSuffix: string,
    resourceType: "image" | "auto" | "raw",
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: this.folderPath(folderSuffix),
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error || !result) {
            reject(
              new ApiException(
                ErrorCode.VALIDATION_ERROR,
                error?.message ?? "Cloudinary upload failed",
                HttpStatus.BAD_GATEWAY,
              ),
            );
            return;
          }
          resolve(this.mapResult(result, file.originalname));
        },
      );

      Readable.from(file.buffer).pipe(stream);
    });
  }

  private mapResult(
    result: UploadApiResponse,
    originalFilename?: string,
  ): CloudinaryUploadResult {
    return {
      publicId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
      format: result.format,
      bytes: result.bytes,
      resourceType: result.resource_type,
      originalFilename,
    };
  }
}
