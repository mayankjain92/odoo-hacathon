export type CloudinaryUploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  format?: string;
  bytes?: number;
  resourceType: string;
  originalFilename?: string;
};

export type AssetDocumentMeta = {
  publicId: string;
  url: string;
  originalName: string;
  format?: string;
  bytes?: number;
  resourceType: string;
  uploadedAt: string;
};
