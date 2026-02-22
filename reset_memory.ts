import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  await db.aIMemory.deleteMany();
  console.log("Memory cleared successfully!");
}

main().catch(console.error).finally(() => db.$disconnect());
