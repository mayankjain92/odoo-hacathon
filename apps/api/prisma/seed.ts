import "dotenv/config";
import * as bcrypt from "bcryptjs";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Cleaning database tables...");

  // Break circular foreign key relations
  await prisma.department.updateMany({ data: { headId: null } });
  await prisma.user.updateMany({ data: { departmentId: null } });

  // Delete dependent rows
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditItem.deleteMany();
  await prisma.auditCycleAuditor.deleteMany();
  await prisma.auditCycle.deleteMany();
  await prisma.maintenanceRequest.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.transferRequest.deleteMany();
  await prisma.allocation.deleteMany();
  await prisma.asset.deleteMany();
  
  // Delete independent core models
  await prisma.assetCategory.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.assetTagSequence.deleteMany();

  console.log("Creating clean System Administrator account...");

  const passwordHash = await bcrypt.hash("adminpassword123", 10);
  const admin = await prisma.user.create({
    data: {
      id: "admin-1",
      name: "System Administrator",
      email: "admin@assetflow.com",
      passwordHash,
      role: Role.Admin,
    },
  });

  // Initialize tag sequence counter
  await prisma.assetTagSequence.create({
    data: { id: 1, value: 0 },
  });

  console.log("-----------------------------------------");
  console.log("Database reset and seeded successfully!");
  console.log("Email: admin@assetflow.com");
  console.log("Password: adminpassword123");
  console.log("-----------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
