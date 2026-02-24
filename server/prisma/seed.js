const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const supplier = await prisma.supplier.create({
    data: {
      name: "Supplier A"
    }
  })

  await prisma.event.createMany({
    data: [
      {
        supplierId: supplier.id,
        type: "quality_issue",
        severity: 0.8,
        impactCost: 50000,
        confidence: 0.9
      },
      {
        supplierId: supplier.id,
        type: "delay",
        severity: 0.5,
        impactCost: 20000,
        confidence: 0.8
      }
    ]
  })

  console.log("Seed data added")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())