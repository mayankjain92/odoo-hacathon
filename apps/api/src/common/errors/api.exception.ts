import {
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { ErrorCode } from "@assetflow/shared";

export class ApiException extends HttpException {
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: HttpStatus,
    details?: unknown,
  ) {
    super({ statusCode, code, message, details }, statusCode);
  }
}
