import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.department.create({ data: { name: 'Engineering', status: 'Active' } });
  await prisma.department.create({ data: { name: 'HR', status: 'Active' } });
  
  await prisma.assetCategory.create({ 
    data: { 
      name: 'Laptops', 
      description: 'Company issued laptops',
      optionalFields: { 'RAM': 'string', 'Storage': 'string', 'Processor': 'string' } 
    } 
  });
  await prisma.assetCategory.create({ 
    data: { 
      name: 'Monitors', 
      description: 'External displays',
      optionalFields: { 'Resolution': 'string', 'Size': 'string' } 
    } 
  });
  
  console.log('Seeded sample data');
}
main().catch(console.error).finally(() => prisma.$disconnect());
