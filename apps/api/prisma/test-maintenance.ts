import "dotenv/config";
import { PrismaClient, Role, AssetStatus, MaintenanceStatus, MaintenancePriority, EntityStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MaintenanceService } from "../src/maintenance/maintenance.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { ApiException } from "../src/common/errors/api.exception";
import { HttpStatus } from "@nestjs/common";
import { ErrorCode } from "@assetflow/shared";
import * as assert from "assert";

async function runTests() {
  console.log("=== STARTING MAINTENANCE MODULE BACKEND TESTS ===");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prismaService = new PrismaService();
  await prismaService.onModuleInit();

  const service = new MaintenanceService(prismaService);

  // --- CLEANUP TEST ENTITIES ---
  console.log("Cleaning up previous test data...");
  await prismaService.transferRequest.deleteMany({});
  await prismaService.notification.deleteMany({});
  await prismaService.maintenanceRequest.deleteMany({});
  await prismaService.allocation.deleteMany({});
  await prismaService.activityLog.deleteMany({});
  await prismaService.asset.deleteMany({ where: { id: { startsWith: "test-" } } });
  await prismaService.user.deleteMany({ where: { id: { startsWith: "test-" } } });
  await prismaService.department.deleteMany({ where: { id: { startsWith: "test-" } } });

  // --- SETUP DATA ---
  console.log("Setting up test users, departments, and assets...");
  const deptEngineering = await prismaService.department.create({
    data: {
      id: "test-dept-eng",
      name: "Test Engineering",
      status: EntityStatus.Active,
    },
  });

  const employee = await prismaService.user.create({
    data: {
      id: "test-user-emp",
      name: "Test Employee",
      email: "emp@assetflow.local",
      passwordHash: "dummy",
      role: Role.Employee,
      status: EntityStatus.Active,
      departmentId: deptEngineering.id,
    },
  });

  const manager = await prismaService.user.create({
    data: {
      id: "test-user-manager",
      name: "Asset Manager",
      email: "manager@assetflow.local",
      passwordHash: "dummy",
      role: Role.AssetManager,
      status: EntityStatus.Active,
      departmentId: deptEngineering.id,
    },
  });

  const category = await prismaService.assetCategory.findFirst({
    where: { name: "Electronics" },
  });
  if (!category) {
    throw new Error("Seed categories missing. Please seed first.");
  }

  const laptop = await prismaService.asset.create({
    data: {
      id: "test-asset-laptop",
      name: "Laptop AF-0114",
      assetTag: "AF-0114",
      categoryId: category.id,
      status: AssetStatus.Available,
      acquisitionDate: new Date(),
      departmentId: deptEngineering.id,
    },
  });

  // ==========================================
  // TEST 1: Raise maintenance request (Pending)
  // ==========================================
  console.log("\n[TEST 1] Raising maintenance request...");
  const req1 = await service.createRequest(
    {
      assetId: laptop.id,
      description: "Screen flicker issue",
      priority: MaintenancePriority.High,
    },
    employee.id,
  );

  assert.strictEqual(req1.status, MaintenanceStatus.Pending);
  assert.strictEqual(req1.assetId, laptop.id);
  assert.strictEqual(req1.requesterId, employee.id);

  // Asset status should remain Available while request is Pending
  const asset1 = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(asset1?.status, AssetStatus.Available);
  console.log("✓ TEST 1 PASSED: Maintenance request raised in Pending status. Asset remains Available.");

  // ==========================================
  // TEST 2: Approve Request (Transition to Approved)
  // ==========================================
  console.log("\n[TEST 2] Approving request...");
  const req2 = await service.updateStatus(
    req1.id,
    { status: MaintenanceStatus.Approved },
    manager.id,
  );

  assert.strictEqual(req2.status, MaintenanceStatus.Approved);

  // Asset status should transition to UnderMaintenance
  const asset2 = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(asset2?.status, AssetStatus.UnderMaintenance);
  console.log("✓ TEST 2 PASSED: Request approved. Asset status transitions to UnderMaintenance.");

  // ==========================================
  // TEST 3: Invalid Transition Check (Terminal Rejected/Resolved, backwards)
  // ==========================================
  console.log("\n[TEST 3] Testing illegal transition Approved -> Pending...");
  try {
    await service.updateStatus(
      req1.id,
      { status: MaintenanceStatus.Pending },
      manager.id,
    );
    assert.fail("Should have failed on illegal transition");
  } catch (error: any) {
    assert.ok(error instanceof ApiException, "Expected ApiException");
    assert.strictEqual(error.getStatus(), HttpStatus.CONFLICT);
    assert.strictEqual(error.getResponse().code, ErrorCode.INVALID_STATUS_TRANSITION);
    console.log("✓ TEST 3 PASSED: Backwards transition blocked with INVALID_STATUS_TRANSITION code.");
  }

  // ==========================================
  // TEST 4: Technician Assignment
  // ==========================================
  console.log("\n[TEST 4] Assigning technician...");
  const req4 = await service.updateStatus(
    req1.id,
    {
      status: MaintenanceStatus.TechnicianAssigned,
      technician: "John Doe",
    },
    manager.id,
  );

  assert.strictEqual(req4.status, MaintenanceStatus.TechnicianAssigned);
  assert.strictEqual(req4.technician, "John Doe");
  console.log("✓ TEST 4 PASSED: Technician John Doe assigned successfully.");

  // ==========================================
  // TEST 5: Work In Progress
  // ==========================================
  console.log("\n[TEST 5] Starting work (InProgress)...");
  const req5 = await service.updateStatus(
    req1.id,
    { status: MaintenanceStatus.InProgress },
    manager.id,
  );

  assert.strictEqual(req5.status, MaintenanceStatus.InProgress);
  console.log("✓ TEST 5 PASSED: Request status transitions to InProgress.");

  // ==========================================
  // TEST 6: Resolve Request - Revert to Available (no active allocation)
  // ==========================================
  console.log("\n[TEST 6] Resolving request (Without active allocation)...");
  const req6 = await service.updateStatus(
    req1.id,
    { status: MaintenanceStatus.Resolved },
    manager.id,
  );

  assert.strictEqual(req6.status, MaintenanceStatus.Resolved);

  // Asset status should transition back to Available
  const asset6 = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(asset6?.status, AssetStatus.Available);
  console.log("✓ TEST 6 PASSED: Request resolved. Asset status reverts to Available.");

  // ==========================================
  // TEST 7: Resolve Request - Revert to Allocated (with active allocation)
  // ==========================================
  console.log("\n[TEST 7] Resolving request (With active allocation)...");
  
  // Set asset status to Allocated and create active allocation
  await prismaService.asset.update({
    where: { id: laptop.id },
    data: { status: AssetStatus.Allocated },
  });
  await prismaService.allocation.create({
    data: {
      assetId: laptop.id,
      employeeId: employee.id,
      active: true,
    },
  });

  // Raise new maintenance request
  const newReq = await service.createRequest(
    {
      assetId: laptop.id,
      description: "Keyboard key sticky",
      priority: MaintenancePriority.Medium,
    },
    employee.id,
  );

  // Approve
  await service.updateStatus(
    newReq.id,
    { status: MaintenanceStatus.Approved },
    manager.id,
  );

  const assetPostApproved = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(assetPostApproved?.status, AssetStatus.UnderMaintenance);

  // Resolve
  await service.updateStatus(
    newReq.id,
    { status: MaintenanceStatus.Resolved },
    manager.id,
  );

  // Asset status should revert to Allocated since allocation is active
  const assetPostResolved = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(assetPostResolved?.status, AssetStatus.Allocated);
  console.log("✓ TEST 7 PASSED: Request resolved. Asset status reverts to Allocated because allocation is active.");

  console.log("\n=== ALL MAINTENANCE TESTS PASSED SUCCESSFULLY! ===");
  await prismaService.$disconnect();
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
