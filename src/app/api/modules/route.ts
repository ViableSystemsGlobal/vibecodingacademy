import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ModuleManager } from "@/lib/module-manager";
import { getModules } from "@/modules/registry";

/**
 * GET /api/modules
 * Get all modules (with database state)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission to view modules
    const userRole = (session.user as any).role;
    if (userRole !== "SUPER_ADMIN" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get modules from database
    let dbModules = [];
    try {
      dbModules = await ModuleManager.getAll();
    } catch (error: any) {
      // If table doesn't exist yet, use empty array
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.warn("Modules table not found, using code definitions only");
        dbModules = [];
      } else {
        throw error;
      }
    }
    
    // Get module definitions from code
    const codeModules = getModules();

    // Merge database state with code definitions
    const modules = codeModules.map((codeModule) => {
      const dbModule = dbModules.find((m) => m.slug === codeModule.slug);
      
      // Parse featureFlags from JSON string to array
      let featureFlags: string[] = codeModule.featureFlags ?? [];
      if (dbModule?.featureFlags) {
        try {
          featureFlags = JSON.parse(dbModule.featureFlags);
        } catch (e) {
          // If parsing fails, use code definition
          featureFlags = codeModule.featureFlags ?? [];
        }
      }
      
      return {
        ...codeModule,
        // Database state
        isEnabled: dbModule?.isEnabled ?? true,
        isSystem: dbModule?.isSystem ?? codeModule.slug === "core",
        version: dbModule?.version ?? codeModule.version ?? "1.0.0",
        priority: dbModule?.priority ?? codeModule.priority ?? 1000,
        category: dbModule?.category ?? codeModule.category,
        // Database metadata
        id: dbModule?.id,
        alias: dbModule?.alias,
        monthlyPrice: dbModule?.monthlyPrice,
        yearlyPrice: dbModule?.yearlyPrice,
        packageName: dbModule?.packageName,
        image: dbModule?.image,
        featureFlags,
        createdAt: dbModule?.createdAt,
        updatedAt: dbModule?.updatedAt,
      };
    });

    return NextResponse.json({ modules });
  } catch (error: any) {
    console.error("Error fetching modules:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch modules",
        details: error.message,
        code: error.code
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/modules
 * Register/sync modules from code to database
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has permission
    const userRole = (session.user as any).role;
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get all module definitions from code
    const codeModules = getModules();

    // Register all modules
    const registeredModules = await ModuleManager.registerAll(codeModules);

    return NextResponse.json({
      success: true,
      message: `Registered ${registeredModules.length} modules`,
      modules: registeredModules,
    });
  } catch (error) {
    console.error("Error registering modules:", error);
    return NextResponse.json(
      { error: "Failed to register modules" },
      { status: 500 }
    );
  }
}

