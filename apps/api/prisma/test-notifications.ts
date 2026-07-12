import "dotenv/config";
import { PrismaService } from "../src/prisma/prisma.service";
import { NotificationType, Role, ActivityAction, EntityType } from "@assetflow/shared";
import { NotificationsService } from "../src/notifications/notifications.service";
import { ActivityLogService } from "../src/notifications/activity-log.service";
import * as assert from "assert";

async function runTests() {
  console.log("=== Starting Notifications and Activity Logs Integration Tests ===\n");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = new PrismaService();
  await prisma.onModuleInit();
  
  const notificationsService = new NotificationsService(prisma);
  const activityLogService = new ActivityLogService(prisma);

  // Clean DB
  console.log("Cleaning up previous test data...");
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany({ where: { email: { contains: "notify@example.com" } } });

  // Create Users
  console.log("Creating test users...");
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin-notify@example.com",
      passwordHash: "hash",
      role: Role.Admin,
    },
  });

  const employee = await prisma.user.create({
    data: {
      name: "Employee User",
      email: "employee-notify@example.com",
      passwordHash: "hash",
      role: Role.Employee,
    },
  });

  let failed = 0;

  function runAssert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Create notifications
    console.log("Creating notifications...");
    await notificationsService.createNotification(
      employee.id,
      "Asset Assigned",
      "Asset AF-1005 has been assigned to you.",
      NotificationType.AssetAssigned,
    );
    await notificationsService.createNotification(
      employee.id,
      "Maintenance Approved",
      "Maintenance for AF-1002 was approved.",
      NotificationType.MaintenanceUpdate,
    );
    await notificationsService.createNotification(
      employee.id,
      "Booking Confirmed",
      "Your booking for Meeting Room A is confirmed.",
      NotificationType.BookingUpdate,
    );
    await notificationsService.createNotification(
      employee.id,
      "Audit Discrepancy",
      "Missing asset AF-1009 in your department.",
      NotificationType.AuditDiscrepancy,
    );
    await notificationsService.createNotification(
      employee.id,
      "Overdue Allocation",
      "Asset AF-1001 is overdue.",
      NotificationType.AllocationOverdue,
    );
    await notificationsService.createNotification(
      employee.id,
      "Booking Reminder",
      "Your booking starts in 15 mins.",
      NotificationType.BookingReminder,
    );
    await notificationsService.createNotification(
      employee.id,
      "Maintenance Rejected",
      "Maintenance for AF-1003 was rejected.",
      NotificationType.MaintenanceUpdate,
    );
    await notificationsService.createNotification(
      employee.id,
      "Booking Cancelled",
      "Your booking for Projector is cancelled.",
      NotificationType.BookingUpdate,
    );
    await notificationsService.createNotification(
      employee.id,
      "Transfer Approved",
      "Transfer request for AF-1008 has been approved.",
      NotificationType.TransferRequest,
    );

    // 2. Fetch notifications for employee
    let userNotifs = await notificationsService.getUserNotifications(employee.id, {});
    runAssert(userNotifs.data.length === 9, "Should have 9 notifications");

    // 3. Mark one as read
    const notifId = userNotifs.data[0].id;
    await notificationsService.markAsRead(employee.id, notifId);
    
    // Check if it was marked as read
    let checkRead = await prisma.notification.findUnique({ where: { id: notifId } });
    runAssert(checkRead?.readAt !== null, "Should mark notification as read");

    // 4. Fetch unread notifications only
    let unreadNotifs = await notificationsService.getUserNotifications(employee.id, { unreadOnly: true });
    runAssert(unreadNotifs.data.length === 8, "Should have 8 unread notification");

    // 5. Mark all as read
    await notificationsService.markAllAsRead(employee.id);

    unreadNotifs = await notificationsService.getUserNotifications(employee.id, { unreadOnly: true });
    runAssert(unreadNotifs.data.length === 0, "Should have 0 unread notifications");

    // 6. Test Activity Logs creation
    await activityLogService.logAction(
      ActivityAction.Created,
      EntityType.Asset,
      "test-asset-id",
      admin.id,
      { assetTag: "AF-1002" },
    );

    // 7. Admin fetches activity logs
    let activityLogs = await activityLogService.getLogs({});
    runAssert(activityLogs.data.length > 0, "Admin should be able to fetch activity logs");
    runAssert(activityLogs.data[0].entityType === EntityType.Asset, "Activity log should have correct entityType");
    runAssert(activityLogs.data[0].action === ActivityAction.Created, "Activity log should have correct action");
    runAssert(activityLogs.data[0].actorId === admin.id, "Activity log should have correct actorId");

  } catch (err: any) {
    console.error(`💥 ERROR: ${err.message}`);
    console.error(err);
    failed++;
  } finally {
    if (failed > 0) {
      console.error(`\n❌ ${failed} tests failed.`);
      process.exit(1);
    } else {
      console.log("\n🎉 All tests passed!");
      process.exit(0);
    }
  }
}

runTests();
