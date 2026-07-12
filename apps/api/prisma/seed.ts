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
  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@assetflow.local" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@assetflow.local",
      passwordHash,
      role: Role.Admin,
    },
  });

  const engineering = await prisma.department.upsert({
    where: { id: "seed-dept-engineering" },
    update: {},
    create: {
      id: "seed-dept-engineering",
      name: "Engineering",
    },
  });

  await prisma.assetCategory.upsert({
    where: { name: "Electronics" },
    update: {},
    create: {
      name: "Electronics",
      description: "Laptops, phones, peripherals",
      optionalFields: { warrantyMonths: 12 },
    },
  });

  await prisma.assetCategory.upsert({
    where: { name: "Furniture" },
    update: {},
    create: {
      name: "Furniture",
      description: "Desks, chairs, cabinets",
    },
  });

  await prisma.assetTagSequence.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, value: 0 },
  });

  console.log("Seeded admin:", admin.email, "| dept:", engineering.name);
  console.log("Login: admin@assetflow.local / Admin@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
