import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateQRCode } from '@/lib/qrcode';

// Currency symbol helper
function getCurrencySymbol(code: string = 'GHS'): string {
  const symbols: { [key: string]: string } = {
    'USD': '$',
    'GHS': 'GH&#8373;',
    'EUR': '€',
    'GBP': '£',
    'NGN': '₦',
    'KES': 'KSh',
    'ZAR': 'R',
  };
  return symbols[code] || code;
}

// Helper function to parse product images
const parseProductImages = (images: string | null | undefined): string[] => {
  if (!images) return [];
  if (typeof images === 'string') {
    try {
      return JSON.parse(images);
    } catch (e) {
      return [];
    }
  }
  if (Array.isArray(images)) {
    return images;
  }
  return [];
};

// Helper to convert relative URLs to absolute
function convertToAbsoluteUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Get base URL from environment or request
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get quotation - no authentication required for public access
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        account: { select: { name: true, email: true, phone: true } },
        distributor: { select: { businessName: true, email: true, phone: true } },
        lead: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
          },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, images: true }
            }
          }
        },
      },
    });

    if (!quotation) {
      return new NextResponse("Quotation not found", { status: 404 });
    }

    const customerName =
      quotation.account?.name ||
      quotation.distributor?.businessName ||
      [quotation.lead?.firstName, quotation.lead?.lastName].filter(Boolean).join(" ") ||
      "Customer";

    const customerEmail =
      quotation.account?.email ||
      quotation.distributor?.email ||
      quotation.lead?.email ||
      "";

    const customerPhone =
      quotation.account?.phone ||
      quotation.distributor?.phone ||
      quotation.lead?.phone ||
      "";

    const currencySymbol = getCurrencySymbol(quotation.currency || 'GHS');
    const formatCurrency = (amount: number) =>
      `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const issueDate = new Date(quotation.createdAt).toLocaleDateString();
    const validUntil = quotation.validUntil
      ? new Date(quotation.validUntil).toLocaleDateString()
      : null;

    // Get PDF settings
    const [logoSetting, headerImageSetting, footerImageSetting] = await Promise.all([
      prisma.systemSettings.findFirst({ where: { key: 'company_logo' } }),
      prisma.systemSettings.findFirst({ where: { key: 'pdf_header_image' } }),
      prisma.systemSettings.findFirst({ where: { key: 'pdf_footer_image' } })
    ]);

    const logoUrl = convertToAbsoluteUrl(logoSetting?.value || null);
    const pdfHeaderImage = convertToAbsoluteUrl(headerImageSetting?.value || null);
    const pdfFooterImage = convertToAbsoluteUrl(footerImageSetting?.value || null);

    const footerMargin = pdfFooterImage ? '160px' : '0';

    // Generate QR code with public URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const publicPdfUrl = `${baseUrl}/api/public/quotations/${quotation.id}/pdf`;
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await generateQRCode(publicPdfUrl);
    } catch (qrError) {
      console.error('Failed to generate QR code:', qrError);
    }

    // Check for discounts
    const hasDiscounts = quotation.lines.some((line: any) => line.discount > 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Quotation ${quotation.number}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 12px;
            color: #1f2937;
            line-height: 1.5;
            padding: 0;
            margin: 0;
          }
          
          .pdf-header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 120px;
            background: white;
            z-index: 1000;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .pdf-header img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .pdf-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 150px;
            background: white;
            z-index: 1000;
            border-top: 2px solid #e5e7eb;
          }
          
          .pdf-footer img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .content {
            padding: ${pdfHeaderImage ? '140px' : '20px'} 40px ${footerMargin} 40px;
            min-height: 100vh;
          }
          
          .header-section {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
          }
          
          .logo-container {
            flex: 0 0 auto;
          }
          
          .logo-container img {
            max-height: 80px;
            max-width: 200px;
            object-fit: contain;
          }
          
          .document-info {
            text-align: right;
            flex: 1;
            margin-left: 20px;
          }
          
          .document-title {
            font-size: 28px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .document-number {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 8px;
          }
          
          .document-date {
            font-size: 12px;
            color: #6b7280;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 30px;
            margin-bottom: 30px;
          }
          
          .info-label {
            font-size: 11px;
            color: #6b7280;
            text-transform: uppercase;
            margin-bottom: 6px;
            font-weight: 600;
          }
          
          .info-value {
            font-size: 14px;
            color: #1f2937;
            font-weight: 600;
            margin-bottom: 4px;
          }
          
          .info-sub {
            font-size: 12px;
            color: #6b7280;
            margin-top: 4px;
          }
          
          .items-section {
            margin-bottom: 30px;
          }
          
          .items-label {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 12px;
            color: #1f2937;
          }
          
          .table-container {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .table-header {
            display: grid;
            grid-template-columns: 40px 2fr 80px 100px ${hasDiscounts ? '80px' : ''} 120px;
            background-color: #f9fafb;
            border-bottom: 2px solid #e5e7eb;
            font-weight: 600;
            font-size: 11px;
            color: #374151;
            text-transform: uppercase;
          }
          
          .table-header-cell {
            padding: 12px 8px;
            text-align: left;
            border-right: 1px solid #e5e7eb;
          }
          
          .table-header-cell:last-child {
            border-right: none;
            text-align: right;
          }
          
          .table-body {
            background-color: white;
          }
          
          .table-row {
            display: grid;
            grid-template-columns: 40px 2fr 80px 100px ${hasDiscounts ? '80px' : ''} 120px;
            border-bottom: 1px solid #f3f4f6;
          }
          
          .table-row:last-child {
            border-bottom: none;
          }
          
          .row-number {
            padding: 12px 8px;
            text-align: center;
            border-right: 1px solid #f3f4f6;
            color: #6b7280;
            font-size: 12px;
          }
          
          .row-description {
            padding: 8px 6px;
            border-right: 1px solid #f3f4f6;
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
            overflow: hidden;
          }
          
          .product-image {
            width: 24px;
            height: 24px;
            border-radius: 4px;
            object-fit: cover;
            background-color: #e5e7eb;
            flex-shrink: 0;
          }
          
          .product-details {
            flex: 1;
            min-width: 0;
            overflow: hidden;
            word-wrap: break-word;
            font-size: 11px;
            line-height: 1.3;
          }
          
          .row-sku {
            font-size: 11px;
            color: #6b7280;
            margin-top: 2px;
          }
          
          .row-other {
            padding: 8px 6px;
            text-align: right;
            border-right: 1px solid #f3f4f6;
            color: #374151;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 12px;
          }
          
          .row-discount {
            padding: 12px 8px;
            text-align: right;
            border-right: 1px solid #f3f4f6;
            color: #059669;
            font-weight: 500;
          }
          
          .row-discount-dash {
            padding: 12px 8px;
            text-align: center;
            border-right: 1px solid #f3f4f6;
            color: #9ca3af;
          }
          
          .row-amount {
            padding: 8px 6px;
            text-align: right;
            font-weight: 600;
            color: #1f2937;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 12px;
          }
          
          .totals-section {
            border-top: 2px solid #e5e7eb;
            padding-top: 20px;
            margin-bottom: 30px;
          }
          
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            font-size: 14px;
          }
          
          .total-final {
            font-size: 16px;
            font-weight: bold;
            border-top: 1px solid #d1d5db;
            padding-top: 12px;
            margin-top: 8px;
          }
          
          .total-label {
            color: #6b7280;
          }
          
          .total-value {
            font-weight: 600;
            color: #1f2937;
          }
          
          .total-black {
            color: #000000 !important;
            font-weight: bold;
          }
          
          .notes-section {
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
          }
          
          .notes-title {
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
          }
          
          .notes-content {
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
            white-space: pre-wrap;
          }
          
          .qr-code-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
          }
          
          .qr-code-title {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 8px;
          }
          
          .qr-code-image {
            width: 120px;
            height: 120px;
          }
          
          .qr-code-text {
            font-size: 10px;
            color: #6b7280;
            text-align: center;
          }
          
          @media print {
            .pdf-header, .pdf-footer {
              position: fixed;
            }
            
            .content {
              margin-bottom: ${footerMargin};
            }
            
            .pdf-header, .pdf-footer {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${pdfHeaderImage ? `<div class="pdf-header"><img src="${pdfHeaderImage}" alt="PDF Header" /></div>` : ''}
        
        <div class="content">
          <div class="header-section">
            <div class="logo-container">
              ${logoUrl ? `<img src="${logoUrl}" alt="Company Logo" />` : ''}
            </div>
            <div class="document-info">
              <div class="document-title">QUOTATION</div>
              <div class="document-number">${quotation.number}</div>
              <div class="document-date">Date: ${issueDate}${validUntil ? ` | Valid Until: ${validUntil}` : ''}</div>
            </div>
          </div>

          <div class="info-grid">
            <div>
              <div class="info-label">From</div>
              <div class="info-value">${quotation.owner.name}</div>
              <div class="info-sub">${quotation.owner.email}</div>
            </div>
            <div>
              <div class="info-label">Bill To</div>
              <div class="info-value">${customerName}</div>
              <div class="info-sub">
                <div>${customerEmail}</div>
                <div>${customerPhone}</div>
              </div>
            </div>
          </div>

          <!-- Items Section -->
          <div class="items-section">
            <div class="items-label">Items</div>
            ${quotation.lines && quotation.lines.length > 0 ? `
              <div class="table-container">
                <div class="table-header">
                  <div class="table-header-cell">#</div>
                  <div class="table-header-cell">Description</div>
                  <div class="table-header-cell">Qty</div>
                  <div class="table-header-cell">Unit Price</div>
                  ${hasDiscounts ? '<div class="table-header-cell">Discount</div>' : ''}
                  <div class="table-header-cell">Amount</div>
                </div>
                <div class="table-body">
                  ${quotation.lines.map((line: any, index: number) => {
                    const images = parseProductImages(line.product?.images);
                    const imageUrl = images.length > 0 ? images[0] : '';
                    return `
                    <div class="table-row">
                      <div class="row-number">${index + 1}</div>
                      <div class="row-description">
                        ${imageUrl ? `<img src="${imageUrl}" alt="Product" class="product-image" onerror="this.style.display='none'" />` : ''}
                        <div class="product-details">
                        ${line.product?.name || line.productName || `Item ${index + 1}`}
                        ${line.product?.sku || line.sku ? `<div class="row-sku">SKU: ${line.product?.sku || line.sku}</div>` : ''}
                        ${line.description ? `<div class="row-sku">${line.description}</div>` : ''}
                        </div>
                      </div>
                      <div class="row-other">${line.quantity}</div>
                      <div class="row-other">${formatCurrency(line.unitPrice)}</div>
                      ${hasDiscounts ? `
                        <div class="${line.discount > 0 ? 'row-discount' : 'row-discount-dash'}">
                          ${line.discount > 0 ? `${line.discount}%` : '-'}
                        </div>
                      ` : ''}
                      <div class="row-amount">${formatCurrency(line.lineTotal)}</div>
                    </div>
                  `;
                  }).join('')}
                </div>
              </div>
            ` : `
              <div style="text-align: center; padding: 16px; color: #9ca3af; font-style: italic;">
                No items added
              </div>
            `}
          </div>

          <!-- Totals Section -->
          <div class="totals-section">
            ${!quotation.taxInclusive ? `
              <div class="total-row">
                <span class="total-label">Subtotal:</span>
                <span class="total-value">${formatCurrency(quotation.subtotal)}</span>
              </div>
              ${(() => {
                const totalDiscount = quotation.lines.reduce((sum: number, line: any) => {
                  const discountAmount = (line.unitPrice * line.quantity * line.discount) / 100;
                  return sum + discountAmount;
                }, 0);
                return totalDiscount > 0 ? `
                  <div class="total-row">
                    <span class="total-label">Discount:</span>
                    <span class="total-value" style="color: #059669;">-${formatCurrency(totalDiscount)}</span>
                  </div>
                ` : '';
              })()}
              <div class="total-row">
                <span class="total-label">Tax:</span>
                <span class="total-value">${formatCurrency(quotation.tax)}</span>
              </div>
            ` : ''}
            <div class="total-row total-final">
              <span>${quotation.taxInclusive ? 'Total (Tax Inclusive):' : 'Total:'}</span>
              <span class="total-black">${formatCurrency(quotation.total)}</span>
            </div>
          </div>

          ${quotation.notes ? `
            <div class="notes-section">
              <div class="notes-title">Notes</div>
              <div class="notes-content">${quotation.notes}</div>
            </div>
          ` : ''}
          
          <!-- QR Code Section -->
          ${qrCodeDataUrl ? `
            <div class="qr-code-section">
              <div class="qr-code-title">QR Code</div>
              <img src="${qrCodeDataUrl}" alt="QR Code" class="qr-code-image" />
              <div class="qr-code-text">Scan to view quotation details</div>
            </div>
          ` : ''}
        </div>
        
        ${pdfFooterImage ? `<div class="pdf-footer"><img src="${pdfFooterImage}" alt="PDF Footer" /></div>` : ''}
      </body>
      </html>
    `;

    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('❌ Public Quotation PDF API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}

