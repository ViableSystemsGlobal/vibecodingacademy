import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
// @ts-ignore - adm-zip doesn't have types
import AdmZip from 'adm-zip';

/**
 * POST /api/products/bulk-upload-images
 * 
 * Uploads product images from a ZIP file.
 * Images should be named by SKU (e.g., PROD-001.jpg, PROD-001-2.jpg for multiple images)
 * 
 * Expected ZIP structure:
 * - PROD-001.jpg (main image)
 * - PROD-001-2.jpg (second image for same product)
 * - PROD-002.png
 * - SERV-001.jpg (for services using serviceCode)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const zipFile = formData.get('zipFile') as File;

    if (!zipFile) {
      return NextResponse.json(
        { error: 'No ZIP file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!zipFile.name.endsWith('.zip') && zipFile.type !== 'application/zip' && zipFile.type !== 'application/x-zip-compressed') {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a ZIP file.' },
        { status: 400 }
      );
    }

    // Validate file size (50MB limit)
    if (zipFile.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'ZIP file size must be less than 50MB' },
        { status: 400 }
      );
    }

    // Create temp directory for extraction
    const tempDir = join(process.cwd(), 'temp', 'bulk-images', Date.now().toString());
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Save ZIP file temporarily
    const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
    const zipPath = join(tempDir, 'images.zip');
    await writeFile(zipPath, zipBuffer);

    // Extract ZIP
    const zip = new AdmZip(zipBuffer);
    const extractPath = join(tempDir, 'extracted');
    zip.extractAllTo(extractPath, true);

    // Get all extracted files
    const extractedFiles = await readdir(extractPath, { recursive: true });
    const imageFiles = extractedFiles.filter(file => {
      const fileName = String(file);
      // Skip hidden files, macOS metadata, and directories
      if (fileName.startsWith('.') || fileName.includes('__MACOSX') || fileName.includes('.DS_Store')) {
        return false;
      }
      const ext = fileName.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext || '');
    });

    console.log(`Found ${imageFiles.length} image files in ZIP`);
    console.log('Image files:', imageFiles);

    // Create uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'product');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Fetch all products for case-insensitive matching (SQLite doesn't support mode: 'insensitive')
    const allProducts = await prisma.product.findMany({
      select: { id: true, sku: true, serviceCode: true, name: true }
    });
    console.log(`Loaded ${allProducts.length} products for matching`);

    // Create lookup maps (lowercase for case-insensitive matching)
    const skuToProduct: { [key: string]: typeof allProducts[0] } = {};
    const serviceCodeToProduct: { [key: string]: typeof allProducts[0] } = {};
    const nameToProduct: { [key: string]: typeof allProducts[0] } = {};
    
    for (const product of allProducts) {
      if (product.sku) {
        skuToProduct[product.sku.toLowerCase()] = product;
      }
      if (product.serviceCode) {
        serviceCodeToProduct[product.serviceCode.toLowerCase()] = product;
      }
      if (product.name) {
        // Map by full name
        nameToProduct[product.name.toLowerCase()] = product;
        
        // Also map by name parts (before first comma, before first space with special chars)
        const nameBeforeComma = product.name.split(',')[0].trim().toLowerCase();
        if (nameBeforeComma && !nameToProduct[nameBeforeComma]) {
          nameToProduct[nameBeforeComma] = product;
        }
        
        // Map by first part of name (common for product codes like EPV150-WIFI+RS485)
        const firstPart = product.name.split(/[\s,]/)[0].trim().toLowerCase();
        if (firstPart && !nameToProduct[firstPart]) {
          nameToProduct[firstPart] = product;
        }
      }
    }
    
    console.log('Sample SKU mappings:', Object.keys(skuToProduct).slice(0, 10));
    console.log('Sample name mappings:', Object.keys(nameToProduct).slice(0, 10));

    // Group images by SKU/serviceCode
    const imagesBySku: { [key: string]: string[] } = {};
    const notFoundSkus: string[] = [];

    for (const imageFile of imageFiles) {
      // Extract SKU/serviceCode from filename
      // Support formats: PROD-001.jpg, PROD-001-2.jpg, PROD-001_2.jpg, SERV-001.jpg
      const fileName = (imageFile as string).split('/').pop() || imageFile;
      const nameWithoutExt = (fileName as string).replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
      
      // Remove ONLY multiple image suffixes like -2, _2, (2) at the very end
      // But NOT the main SKU numbers like PROD-001
      // Pattern: only remove single digit suffixes that are clearly image counters
      let baseName = nameWithoutExt
        .replace(/[-_](\d)$/, '')           // Remove -2, _3 (single digit only)
        .replace(/\s*\(\d+\)$/, '')          // Remove (1), (2), etc.
        .replace(/\s*copy\s*\d*$/i, '')      // Remove "copy", "copy 2"
        .replace(/\s+$/, '')                 // Trim trailing spaces
        .trim();
      
      const baseNameLower = baseName.toLowerCase();
      
      console.log(`Processing image: ${fileName} -> Looking for: ${baseName}`);
      
      // Try to find product by SKU, serviceCode, or name (case-insensitive)
      let product = skuToProduct[baseNameLower] || serviceCodeToProduct[baseNameLower] || nameToProduct[baseNameLower];
      let matchedBy = 'direct';
      
      // Also try without common prefixes/suffixes
      if (!product) {
        // Try with different variations
        const variations = [
          baseNameLower,
          baseNameLower.replace(/^prod[-_]?/i, ''),
          baseNameLower.replace(/^sku[-_]?/i, ''),
          `prod-${baseNameLower}`,
          `sku-${baseNameLower}`,
          // Try replacing + with different chars (file systems may alter these)
          baseNameLower.replace(/\+/g, ' '),
          baseNameLower.replace(/\+/g, '-'),
          baseNameLower.replace(/\+/g, '_'),
          baseNameLower.replace(/_/g, '+'),
          baseNameLower.replace(/-/g, '+'),
        ];
        
        for (const variation of variations) {
          product = skuToProduct[variation] || serviceCodeToProduct[variation] || nameToProduct[variation];
          if (product) {
            matchedBy = `variation: ${variation}`;
            break;
          }
        }
      }
      
      // Try partial name matching if still not found
      if (!product) {
        // Look for products whose name starts with the filename
        for (const [key, prod] of Object.entries(nameToProduct)) {
          if (key.startsWith(baseNameLower) || baseNameLower.startsWith(key)) {
            product = prod;
            matchedBy = `partial name: ${key}`;
            break;
          }
        }
      }

      if (!product) {
        console.log(`⚠️  No product found for: ${baseName}`);
        if (!notFoundSkus.includes(baseName)) {
          notFoundSkus.push(baseName);
        }
        continue;
      }
      
      console.log(`  ✓ Matched to product: ${product.name} (SKU: ${product.sku}) via ${matchedBy}`);
      

      // Read image file
      const imagePath = join(extractPath, imageFile);
      const imageBuffer = await require('fs').promises.readFile(imagePath);
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = fileName.split('.').pop();
      const uniqueFileName = `product_${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
      const filePath = join(uploadsDir, uniqueFileName);

      // Save image
      await writeFile(filePath, imageBuffer);

      // Get public URL
      const publicUrl = `/uploads/product/${uniqueFileName}`;

      // Group by product identifier (use product ID for grouping)
      const productKey = product.id;
      if (!imagesBySku[productKey]) {
        imagesBySku[productKey] = [];
      }
      imagesBySku[productKey].push(publicUrl);
    }

    // Update products with images
    const results = {
      success: 0,
      failed: 0,
      notFound: 0,
      errors: [] as string[],
      updated: [] as Array<{ sku: string | null; serviceCode: string | null; name: string; imageCount: number }>
    };

    for (const [productId, imageUrls] of Object.entries(imagesBySku)) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          results.notFound++;
          continue;
        }

        // Merge with existing images (if any)
        let existingImages: string[] = [];
        if (product.images) {
          try {
            existingImages = JSON.parse(product.images);
          } catch (e) {
            // If parsing fails, start fresh
            existingImages = [];
          }
        }

        // Combine existing and new images, remove duplicates
        const allImages = [...existingImages, ...imageUrls];
        const uniqueImages = Array.from(new Set(allImages));

        // Update product
        await prisma.product.update({
          where: { id: productId },
          data: {
            images: JSON.stringify(uniqueImages)
          }
        });

        results.success++;
        results.updated.push({
          sku: product.sku,
          serviceCode: product.serviceCode,
          name: product.name,
          imageCount: uniqueImages.length
        });

        console.log(`✅ Updated product ${product.sku || product.serviceCode} with ${uniqueImages.length} images`);
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`Failed to update product ${productId}: ${errorMsg}`);
        console.error(`❌ Error updating product ${productId}:`, error);
      }
    }

    // Cleanup temp directory
    try {
      await require('fs').promises.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up temp directory:', cleanupError);
    }

    return NextResponse.json({
      success: true,
      message: `Bulk image upload completed`,
      results: {
        totalImages: imageFiles.length,
        matchedProducts: Object.keys(imagesBySku).length,
        updated: results.success,
        failed: results.failed,
        notFound: results.notFound,
        notFoundSkus: notFoundSkus, // List of SKUs that weren't found
        updatedProducts: results.updated,
        errors: results.errors
      }
    });

  } catch (error) {
    console.error('Error processing bulk image upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        error: `Failed to process bulk image upload: ${errorMessage}`,
        success: false
      },
      { status: 500 }
    );
  }
}

