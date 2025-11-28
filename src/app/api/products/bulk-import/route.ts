import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateBarcode, validateBarcode, detectBarcodeType } from "@/lib/barcode-utils";

// Helper function to parse CSV content with flexible column mapping
function parseCSV(content: string): any[] {
  try {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      console.log('CSV has less than 2 lines');
      return [];
    }
    
    const originalHeaders = lines[0].split(',').map(h => h.trim().replace(/['"]/g, ''));
    console.log('CSV headers:', originalHeaders);
    
    // Column mapping for flexible header names
    const columnMap: { [key: string]: string } = {
      'SKU': 'sku', 'sku': 'sku', 'product_sku': 'sku',
      'Name': 'name', 'name': 'name', 'product_name': 'name',
      'Description': 'description', 'description': 'description', 'product_description': 'description',
      'Type': 'type', 'type': 'type', 'item_type': 'type',
      'Price': 'price', 'price': 'price', 'selling_price': 'price',
      'Cost': 'cost', 'cost': 'cost', 'cost_price': 'cost', 'purchase_price': 'cost',
      'Quantity': 'quantity', 'quantity': 'quantity', 'stock_quantity': 'quantity',
      'Reorder Point': 'reorder_point', 'reorder_point': 'reorder_point',
      'Import Currency': 'import_currency', 'import_currency': 'import_currency', 'currency': 'import_currency',
      'Selling Currency': 'selling_currency', 'selling_currency': 'selling_currency', 'price_currency': 'selling_currency', 'base_currency': 'selling_currency',
      'UOM Base': 'uom_base', 'uom_base': 'uom_base', 'unit_base': 'uom_base',
      'UOM Sell': 'uom_sell', 'uom_sell': 'uom_sell', 'unit_sell': 'uom_sell',
      'Active': 'active', 'active': 'active',
      'Barcode': 'barcode', 'barcode': 'barcode', 'product_barcode': 'barcode',
      'Barcode Type': 'barcode_type', 'barcode_type': 'barcode_type',
      'Supplier Name': 'supplier_name', 'supplier_name': 'supplier_name',
      'Supplier SKU': 'supplier_sku', 'supplier_sku': 'supplier_sku',
      'Supplier Barcode': 'supplier_barcode', 'supplier_barcode': 'supplier_barcode',
      'Service Code': 'service_code', 'service_code': 'service_code',
      'Duration': 'duration', 'duration': 'duration',
      'Category': 'category', 'category': 'category', 'category_name': 'category'
    };
    
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      // Handle CSV parsing more robustly - handle quoted fields
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim().replace(/['"]/g, ''));
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim().replace(/['"]/g, ''));
      
      const row: any = {};
      
      originalHeaders.forEach((header, index) => {
        const normalizedKey = columnMap[header] || header.toLowerCase();
        row[normalizedKey] = values[index] || '';
      });
      
      rows.push(row);
    }
    
    console.log(`Parsed ${rows.length} rows from CSV`);
    return rows;
  } catch (error) {
    console.error('Error parsing CSV:', error);
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// POST /api/products/bulk-import - Bulk import products from CSV/Excel file
export async function POST(request: NextRequest) {
  try {
    console.log('Starting bulk import process...');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.log('No file provided');
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    const fileContent = await file.text();
    console.log(`File content length: ${fileContent.length} characters`);
    
    const csvData = parseCSV(fileContent);
    console.log(`Parsed CSV data: ${csvData.length} rows`);
    
    const result = {
      success: 0,
      errors: [] as string[],
      warnings: [] as string[]
    };

    if (csvData.length === 0) {
      return NextResponse.json(
        { error: "No valid data found in the file" },
        { status: 400 }
      );
    }

    try {
      // Get default category and warehouse
      const defaultCategory = await prisma.category.findFirst();
      const defaultWarehouse = await prisma.warehouse.findFirst();
      
      if (!defaultCategory) {
        return NextResponse.json(
          { error: "No categories found. Please create a category first." },
          { status: 400 }
        );
      }

      if (!defaultWarehouse) {
        return NextResponse.json(
          { error: "No warehouses found. Please create a warehouse first." },
          { status: 400 }
        );
      }

      for (const row of csvData) {
        try {
          // Validate required fields
          if (!row.sku || !row.name) {
            result.errors.push(`Missing required fields: SKU and Name are required for row`);
            continue;
          }

          // Check for duplicate SKU
          const existingProduct = await prisma.product.findUnique({
            where: { sku: row.sku }
          });
          
          if (existingProduct) {
            result.errors.push(`SKU '${row.sku}' already exists. Skipping product: ${row.name}`);
            continue;
          }

          // Map CSV columns to product data using normalized field names
          const costPrice = parseFloat(row.cost || '0') || 0;
          const productSku = row.sku || `IMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Handle barcode logic
          let primaryBarcode = null;
          let barcodeType = 'EAN13';
          
          if (row.barcode?.trim()) {
            // User provided a barcode
            primaryBarcode = row.barcode.trim();
            barcodeType = detectBarcodeType(primaryBarcode);
            
            // Validate
            if (!validateBarcode(primaryBarcode, barcodeType as any)) {
              console.warn(`Invalid barcode for ${row.name}: ${primaryBarcode}`);
              primaryBarcode = null;
            }
          }
          
          if (!primaryBarcode) {
            // Generate barcode from SKU
            primaryBarcode = generateBarcode(productSku, 'EAN13');
          }
          
          // Check for duplicate barcode
          if (primaryBarcode) {
            const existingBarcode = await prisma.product.findUnique({
              where: { barcode: primaryBarcode }
            });
            
            if (existingBarcode) {
              console.warn(`Duplicate barcode ${primaryBarcode}, generating new one`);
              primaryBarcode = generateBarcode(`${productSku}-${Date.now()}`, 'EAN13');
            }
          }
          
          // Determine product type - normalize to valid ItemType enum values
          const rawType = (row.type || 'PRODUCT').toUpperCase().trim();
          let productType: 'PRODUCT' | 'SERVICE' = 'PRODUCT';
          
          // Map CSV type values to valid ItemType enum
          if (rawType === 'SERVICE' || rawType === 'SERVICES') {
            productType = 'SERVICE';
          } else {
            // All other types (CHEMICALS, TESTING, HARDWARE, CLEANING, etc.) are PRODUCT
            productType = 'PRODUCT';
          }
          
          const isService = productType === 'SERVICE';
          
          // Handle category lookup
          let categoryId = defaultCategory.id;
          if (row.category?.trim()) {
            const category = await prisma.category.findFirst({
              where: { name: { contains: row.category.trim() } }
            });
            if (category) {
              categoryId = category.id;
            }
          }

          const productData = {
            type: productType,
            name: row.name || `Imported ${isService ? 'Service' : 'Product'} ${Date.now()}`,
            sku: isService ? null : productSku, // Services can have null SKU
            serviceCode: isService ? (row.service_code || row.sku || `SERV-${Date.now()}`) : null,
            description: row.description || `Imported ${isService ? 'service' : 'product'} from bulk upload`,
            barcode: isService ? null : primaryBarcode, // Services don't have barcodes
            barcodeType: isService ? null : (primaryBarcode ? (barcodeType as any) : null),
            generateBarcode: !isService && !row.barcode,
            price: parseFloat(row.price || '0') || 0,
            cost: costPrice,
            originalPrice: parseFloat(row.price || '0') || 0,
            originalCost: costPrice,
            originalPriceCurrency: row.import_currency || 'USD',
            originalCostCurrency: row.import_currency || 'USD',
            baseCurrency: row.selling_currency || 'GHS', // Selling price currency
            categoryId: categoryId,
            active: row.active === 'true' || row.active === '1' || row.active === 'yes' || row.active === '' || row.active === undefined,
            uomBase: row.uom_base || (isService ? 'hours' : 'pcs'),
            uomSell: row.uom_sell || (isService ? 'hours' : 'pcs'),
            duration: isService ? row.duration : null
          };

          const product = await prisma.product.create({
            data: productData
          });
          
          // Handle supplier information
          if (row.supplier_name?.trim()) {
            try {
              await prisma.productSupplier.create({
                data: {
                  productId: product.id,
                  supplierName: row.supplier_name.trim(),
                  supplierSku: row.supplier_sku?.trim() || null,
                  supplierBarcode: row.supplier_barcode?.trim() || null,
                  cost: costPrice,
                  isPreferred: true,
                  isActive: true,
                  notes: 'Imported from bulk upload'
                }
              });
            } catch (err) {
              console.error('Error adding supplier information:', err);
            }
          }

          // If supplier barcode is different from primary, add as additional
          if (row.supplier_barcode?.trim() && row.supplier_barcode !== primaryBarcode && !isService) {
            try {
              const supplierBarcodeType = detectBarcodeType(row.supplier_barcode);
              
              if (validateBarcode(row.supplier_barcode, supplierBarcodeType as any)) {
                await prisma.productBarcode.create({
                  data: {
                    productId: product.id,
                    barcode: row.supplier_barcode.trim(),
                    barcodeType: supplierBarcodeType,
                    source: row.supplier_name || 'Supplier',
                    description: 'Supplier provided barcode',
                    isPrimary: false,
                    isActive: true
                  }
                });
              }
            } catch (err) {
              console.error('Error adding supplier barcode:', err);
            }
          }

          // Create stock item for products only (not services)
          if (!isService) {
            const initialQuantity = parseFloat(row.quantity || '0') || 0;
            const totalValue = initialQuantity * costPrice;
            const reorderPoint = parseFloat(row.reorder_point || '0') || 0;
            
            await prisma.stockItem.create({
              data: {
                productId: product.id,
                warehouseId: defaultWarehouse.id,
                quantity: initialQuantity,
                reserved: 0,
                available: initialQuantity,
                averageCost: productData.cost || 0,
                totalValue: totalValue,
                reorderPoint: reorderPoint
              }
            });
          }

          result.success++;
        } catch (rowError) {
          console.error('Error processing row:', row, rowError);
          result.errors.push(`Error processing product: ${row.name || 'Unknown'} - ${rowError instanceof Error ? rowError.message : 'Unknown error'}`);
        }
      }
    } catch (dbError) {
      console.error('Database error during bulk import:', dbError);
      result.errors.push('Database error occurred during import');
    }

    console.log(`Import completed: ${result.success} successful, ${result.errors.length} errors`);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error processing bulk import:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: `Failed to process bulk import: ${errorMessage}`,
        success: 0,
        errors: [`Import failed: ${errorMessage}`],
        warnings: []
      },
      { status: 500 }
    );
  }
}
