import "dotenv/config";
import { PrismaClient, Role, AssetStatus, EntityStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AuditsService } from "../src/audits/audits.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { ApiException } from "../src/common/errors/api.exception";
import { HttpStatus } from "@nestjs/common";
import { AuditCycleStatus, AuditItemResult, ErrorCode } from "@assetflow/shared";
import * as assert from "assert";

async function runTests() {
  console.log("=== STARTING AUDITS MODULE BACKEND TESTS ===");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prismaService = new PrismaService();
  await prismaService.onModuleInit();
  const service = new AuditsService(prismaService);

  // --- CLEANUP TEST ENTITIES ---
  console.log("Cleaning up previous test data...");
  await prismaService.transferRequest.deleteMany({});
  await prismaService.notification.deleteMany({});
  await prismaService.maintenanceRequest.deleteMany({});
  await prismaService.allocation.deleteMany({});
  await prismaService.auditItem.deleteMany({});
  await prismaService.auditCycleAuditor.deleteMany({});
  await prismaService.auditCycle.deleteMany({});
  await prismaService.activityLog.deleteMany({});
  await prismaService.asset.deleteMany({ where: { id: { startsWith: "test-" } } });
  await prismaService.user.deleteMany({ where: { id: { startsWith: "test-" } } });
  await prismaService.department.deleteMany({ where: { id: { startsWith: "test-" } } });

  // --- SETUP DATA ---
  console.log("Setting up test data...");
  const deptEngineering = await prismaService.department.create({
    data: {
      id: "test-dept-eng",
      name: "Test Engineering",
      status: EntityStatus.Active,
    },
  });
  const deptSales = await prismaService.department.create({
    data: {
      id: "test-dept-sales",
      name: "Test Sales",
      status: EntityStatus.Active,
    },
  });

  const auditor1 = await prismaService.user.create({
    data: {
      id: "test-user-auditor",
      name: "Test Auditor",
      email: "auditor@assetflow.local",
      passwordHash: "dummy",
      role: Role.Employee,
      status: EntityStatus.Active,
    },
  });

  const admin = await prismaService.user.create({
    data: {
      id: "test-user-admin",
      name: "Test Admin",
      email: "admin2@assetflow.local",
      passwordHash: "dummy",
      role: Role.Admin,
      status: EntityStatus.Active,
    },
  });

  const category = await prismaService.assetCategory.findFirst({
    where: { name: "Electronics" },
  });
  if (!category) {
    throw new Error("Seed categories missing. Please seed first.");
  }

  const asset1 = await prismaService.asset.create({
    data: {
      id: "test-asset-1",
      name: "Laptop 1",
      assetTag: "TEST-01",
      categoryId: category.id,
      status: AssetStatus.Available,
      acquisitionDate: new Date(),
      departmentId: deptEngineering.id,
      location: "Office A",
    },
  });

  const asset2 = await prismaService.asset.create({
    data: {
      id: "test-asset-2",
      name: "Monitor 1",
      assetTag: "TEST-02",
      categoryId: category.id,
      status: AssetStatus.Allocated,
      acquisitionDate: new Date(),
      departmentId: deptSales.id,
      location: "Office B",
    },
  });

  // ==========================================
  // TEST 1: Create Audit Cycle
  // ==========================================
  console.log("\n[TEST 1] Creating Audit Cycle...");
  const cycle = await service.createCycle(
    {
      name: "Engineering Hardware Audit",
      departmentId: deptEngineering.id,
      location: "Office A",
      startsAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 86400000).toISOString(),
      auditorIds: [auditor1.id],
    },
    admin.id
  );

  assert.strictEqual(cycle.name, "Engineering Hardware Audit");
  assert.strictEqual(cycle.status, AuditCycleStatus.Open);
  assert.strictEqual(cycle.auditors.length, 1);
  assert.strictEqual(cycle.auditors[0].userId, auditor1.id);
  console.log("✓ TEST 1 PASSED");

  // ==========================================
  // TEST 2: Cannot record item when Open
  // ==========================================
  console.log("\n[TEST 2] Verifying cannot scan item before InProgress...");
  try {
    await service.recordItem(
      cycle.id,
      { assetTag: "TEST-01", result: AuditItemResult.Verified },
      auditor1.id
    );
    assert.fail("Should have failed to record item");
  } catch (err: any) {
    assert.ok(err instanceof ApiException);
    assert.strictEqual(err.getResponse().code, ErrorCode.INVALID_STATUS_TRANSITION);
    console.log("✓ TEST 2 PASSED");
  }

  // ==========================================
  // TEST 3: Start Cycle (InProgress)
  // ==========================================
  console.log("\n[TEST 3] Starting Audit Cycle...");
  const inProgressCycle = await service.updateStatus(
    cycle.id,
    { status: AuditCycleStatus.InProgress },
    admin.id
  );
  assert.strictEqual(inProgressCycle.status, AuditCycleStatus.InProgress);
  console.log("✓ TEST 3 PASSED");

  // ==========================================
  // TEST 4: Record Valid Item
  // ==========================================
  console.log("\n[TEST 4] Recording Valid Item...");
  const item1 = await service.recordItem(
    cycle.id,
    { assetTag: "TEST-01", result: AuditItemResult.Verified, notes: "All good" },
    auditor1.id
  );
  assert.strictEqual(item1.result, AuditItemResult.Verified);
  assert.strictEqual(item1.assetId, asset1.id);
  console.log("✓ TEST 4 PASSED");

  // ==========================================
  // TEST 4.5: Record Missing Item
  // ==========================================
  console.log("\n[TEST 4.5] Recording Missing Item...");
  const asset3 = await prismaService.asset.create({
    data: {
      id: "test-asset-3",
      name: "Desktop 1",
      assetTag: "TEST-03",
      categoryId: category.id,
      status: AssetStatus.Available,
      acquisitionDate: new Date(),
      departmentId: deptEngineering.id,
      location: "Office A",
    },
  });
  
  const itemMissing = await service.recordItem(
    cycle.id,
    { assetTag: "TEST-03", result: AuditItemResult.Missing },
    auditor1.id
  );
  assert.strictEqual(itemMissing.result, AuditItemResult.Missing);
  assert.strictEqual(itemMissing.assetId, asset3.id);
  console.log("✓ TEST 4.5 PASSED");

  // ==========================================
  // TEST 5: Reject out-of-scope asset
  // ==========================================
  console.log("\n[TEST 5] Rejecting Out of Scope Asset...");
  try {
    await service.recordItem(
      cycle.id,
      { assetTag: "TEST-02", result: AuditItemResult.Missing },
      auditor1.id
    );
    assert.fail("Should have failed scope check");
  } catch (err: any) {
    assert.ok(err instanceof ApiException);
    assert.strictEqual(err.getResponse().code, ErrorCode.VALIDATION_ERROR);
    console.log("✓ TEST 5 PASSED");
  }

  // ==========================================
  // TEST 6: Close Cycle & Verify Missing Assets are Lost
  // ==========================================
  console.log("\n[TEST 6] Closing Audit Cycle & Verifying Status Updates...");
  const closedCycle = await service.updateStatus(
    cycle.id,
    { status: AuditCycleStatus.Closed },
    admin.id
  );
  assert.strictEqual(closedCycle.status, AuditCycleStatus.Closed);
  assert.ok(closedCycle.lockedAt !== null);

  const missingAsset = await prismaService.asset.findUnique({ where: { id: asset3.id } });
  assert.strictEqual(missingAsset?.status, AssetStatus.Lost);
  
  const verifiedAsset = await prismaService.asset.findUnique({ where: { id: asset1.id } });
  assert.strictEqual(verifiedAsset?.status, AssetStatus.Available);

  console.log("✓ TEST 6 PASSED");

  console.log("\n=== ALL AUDIT TESTS PASSED SUCCESSFULLY! ===");
  await prismaService.$disconnect();
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
