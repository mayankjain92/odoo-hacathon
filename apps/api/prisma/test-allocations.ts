import "dotenv/config";
import { PrismaClient, Role, AssetStatus, TransferStatus, EntityStatus } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AllocationsService } from "../src/allocations/allocations.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { ApiException } from "../src/common/errors/api.exception";
import { HttpStatus } from "@nestjs/common";
import * as assert from "assert";

async function runTests() {
  console.log("=== STARTING ALLOCATIONS MODULE BACKEND TESTS ===");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const adapter = new PrismaPg({ connectionString });
  const prismaService = new PrismaService();
  await prismaService.onModuleInit();

  const service = new AllocationsService(prismaService);

  // --- CLEANUP TEST ENTITIES ---
  console.log("Cleaning up previous test data...");
  await prismaService.transferRequest.deleteMany({});
  await prismaService.notification.deleteMany({});
  await prismaService.activityLog.deleteMany({});
  await prismaService.allocation.deleteMany({});
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

  const priya = await prismaService.user.create({
    data: {
      id: "test-user-priya",
      name: "Priya Patel",
      email: "priya@assetflow.local",
      passwordHash: "dummy",
      role: Role.Employee,
      status: EntityStatus.Active,
      departmentId: deptEngineering.id,
    },
  });

  const raj = await prismaService.user.create({
    data: {
      id: "test-user-raj",
      name: "Raj Kumar",
      email: "raj@assetflow.local",
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
  // TEST 1: Allocate asset to Priya
  // ==========================================
  console.log("\n[TEST 1] Allocating asset to Priya...");
  const expectedReturn = new Date();
  expectedReturn.setDate(expectedReturn.getDate() + 7);

  const alloc1 = await service.allocateAsset(
    {
      assetId: laptop.id,
      employeeId: priya.id,
      expectedReturnAt: expectedReturn.toISOString(),
      notes: "Assigned Laptop for remote work",
    },
    manager.id,
    manager.role,
    manager.departmentId,
  );

  assert.strictEqual(alloc1.active, true);
  assert.strictEqual(alloc1.employeeId, priya.id);
  assert.strictEqual(alloc1.isOverdue, false);

  // Check asset status in DB
  const assetAfterAlloc = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(assetAfterAlloc?.status, AssetStatus.Allocated);
  console.log("✓ TEST 1 PASSED: Asset allocated successfully to Priya. Asset status is Allocated.");

  // ==========================================
  // TEST 2: Conflict Check - Allocate same asset to Raj
  // ==========================================
  console.log("\n[TEST 2] Trying to allocate already-held asset to Raj (Expect Conflict)...");
  try {
    await service.allocateAsset(
      {
        assetId: laptop.id,
        employeeId: raj.id,
        notes: "Trying to take the same laptop",
      },
      manager.id,
      manager.role,
      manager.departmentId,
    );
    assert.fail("Should have failed with conflict exception");
  } catch (error: any) {
    assert.ok(error instanceof ApiException, "Expected ApiException");
    assert.strictEqual(error.getStatus(), HttpStatus.CONFLICT);
    
    const responseBody = error.getResponse() as any;
    assert.strictEqual(responseBody.code, "ASSET_ALREADY_ALLOCATED");
    assert.strictEqual(responseBody.details.holder.name, "Priya Patel");
    assert.strictEqual(responseBody.details.holder.email, "priya@assetflow.local");
    assert.strictEqual(responseBody.details.holder.type, "employee");
    console.log("✓ TEST 2 PASSED: Conflict caught. Error correctly payloaded with 'held by Priya Patel'.");
  }

  // ==========================================
  // TEST 3: Transfer Workflow - Request Transfer
  // ==========================================
  console.log("\n[TEST 3] Raising Transfer Request from Priya to Raj...");
  const transferReq = await service.createTransferRequest(
    {
      assetId: laptop.id,
      toEmployeeId: raj.id,
      notes: "Need laptop for temporary dev task",
    },
    raj.id, // Raj requests the transfer
  );

  assert.strictEqual(transferReq.status, TransferStatus.Requested);
  assert.strictEqual(transferReq.requesterId, raj.id);
  assert.strictEqual(transferReq.toEmployeeId, raj.id);
  console.log("✓ TEST 3 PASSED: Transfer request created successfully in 'Requested' status.");

  // ==========================================
  // TEST 4: Transfer Workflow - Approve Transfer
  // ==========================================
  console.log("\n[TEST 4] Resolving Transfer Request: Approve by Manager...");
  const approvedTransfer = await service.resolveTransferRequest(
    transferReq.id,
    {
      status: TransferStatus.Approved,
      notes: "Approved transfer request",
    },
    manager.id,
    manager.role,
    manager.departmentId,
  );

  assert.strictEqual(approvedTransfer.status, TransferStatus.Approved);

  // Check that Priya's allocation was closed
  const closedAlloc = await prismaService.allocation.findUnique({ where: { id: alloc1.id } });
  assert.strictEqual(closedAlloc?.active, false);
  assert.ok(closedAlloc?.returnedAt instanceof Date);
  assert.match(closedAlloc?.returnNotes || "", /Transferred to new holder/);

  // Check that new allocation is active for Raj
  const activeAllocRaj = await prismaService.allocation.findFirst({
    where: { assetId: laptop.id, active: true },
  });
  assert.ok(activeAllocRaj);
  assert.strictEqual(activeAllocRaj.employeeId, raj.id);
  console.log("✓ TEST 4 PASSED: Transfer approved, Priya's allocation closed, Raj's allocation opened.");

  // ==========================================
  // TEST 5: Return Flow
  // ==========================================
  console.log("\n[TEST 5] Returning asset from Raj with condition notes...");
  const returnedAlloc = await service.returnAsset(
    activeAllocRaj.id,
    {
      returnNotes: "Returned with a minor scratch on top lid",
    },
    manager.id,
    manager.role,
    manager.departmentId,
  );

  assert.strictEqual(returnedAlloc.active, false);
  assert.strictEqual(returnedAlloc.returnNotes, "Returned with a minor scratch on top lid");

  // Check asset status reverted to Available
  const finalAsset = await prismaService.asset.findUnique({ where: { id: laptop.id } });
  assert.strictEqual(finalAsset?.status, AssetStatus.Available);
  console.log("✓ TEST 5 PASSED: Asset returned successfully. Reverted to Available status.");

  // ==========================================
  // TEST 6: Overdue Allocations Job Auto-Flag
  // ==========================================
  console.log("\n[TEST 6] Testing Overdue Allocation scan & notifications...");
  const pastReturnDate = new Date();
  pastReturnDate.setDate(pastReturnDate.getDate() - 1); // Yesterday

  // Create an active allocation in the past
  const overdueAlloc = await prismaService.allocation.create({
    data: {
      assetId: laptop.id,
      employeeId: priya.id,
      expectedReturnAt: pastReturnDate,
      active: true,
    },
  });

  // Trigger scanning job
  const scanResult = await service.scanOverdueAllocations();
  assert.strictEqual(scanResult.count, 1);

  // Verify the allocation is flagged as overdue
  const checkedOverdue = await prismaService.allocation.findUnique({ where: { id: overdueAlloc.id } });
  assert.strictEqual(checkedOverdue?.isOverdue, true);

  // Verify notification was sent to Priya
  const notifications = await prismaService.notification.findMany({
    where: { userId: priya.id },
  });
  assert.strictEqual(notifications.length, 1);
  assert.match(notifications[0].title, /Overdue/);
  console.log("✓ TEST 6 PASSED: Overdue allocations auto-flagged and notification generated successfully.");

  console.log("\n=== ALL ALLOCATIONS TESTS PASSED SUCCESSFULLY! ===");
  await prismaService.$disconnect();
}

runTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
