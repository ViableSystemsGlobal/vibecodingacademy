import { PrismaClient } from "@prisma/client";
import { ModuleManager } from "../src/lib/module-manager";
import { getModules } from "../src/modules/registry";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding modules from code definitions...");

  try {
    // Get all module definitions from code
    const moduleDefinitions = getModules();
    console.log(`📦 Found ${moduleDefinitions.length} module definitions`);

    // Register all modules in database
    const registeredModules = await ModuleManager.registerAll(moduleDefinitions);
    console.log(`✅ Registered ${registeredModules.length} modules`);

    // Display summary
    console.log("\n📋 Module Summary:");
    for (const module of registeredModules) {
      console.log(
        `  - ${module.name} (${module.slug}) - ${module.isEnabled ? "✅ Enabled" : "❌ Disabled"} - Priority: ${module.priority}`
      );
    }

    console.log("\n✨ Module seeding completed!");
  } catch (error) {
    console.error("❌ Error seeding modules:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

