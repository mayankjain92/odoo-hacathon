import { Module } from "@nestjs/common";
import { AuditsController } from "./audits.controller";

@Module({ controllers: [AuditsController] })
export class AuditsModule {}
