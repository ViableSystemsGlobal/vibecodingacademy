import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Currency symbol helper - using HTML entities for proper encoding
function getCurrencySymbol(code: string = 'GHS'): string {
  const symbols: { [key: string]: string } = {
    'USD': '$',
    'GHS': 'GH&#8373;', // Ghana Cedi symbol using HTML entity
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('🔍 Invoice PDF API - Starting request for ID:', id);

    // Get invoice data
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: {
        id: true,
        number: true,
        subject: true,
        status: true,
        paymentStatus: true,
        currency: true,
        total: true,
        subtotal: true,
        tax: true,
        discount: true,
        amountPaid: true,
        amountDue: true,
        taxInclusive: true,
        notes: true,
        paymentTerms: true,
        issueDate: true,
        dueDate: true,
        paidDate: true,
        createdAt: true,
        owner: {
          select: { id: true, name: true, email: true },
        },
        account: {
          select: { id: true, name: true, email: true, phone: true },
        },
        distributor: {
          select: { id: true, businessName: true, email: true, phone: true },
        },
        lead: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true, company: true },
        },
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, price: true, images: true }
            }
          }
        },
      } as any,
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get customer info
    const invoiceData = invoice as any;
    const customerName = invoiceData.account?.name || 
                        invoiceData.distributor?.businessName || 
                        (invoiceData.lead ? `${invoiceData.lead.firstName} ${invoiceData.lead.lastName}`.trim() : '') ||
                        'No customer';
    const customerEmail = invoiceData.account?.email || invoiceData.distributor?.email || invoiceData.lead?.email || '';
    const customerPhone = invoiceData.account?.phone || invoiceData.distributor?.phone || invoiceData.lead?.phone || '';
    
    const hasDiscounts = (invoiceData.lines as any[])?.some((line: any) => line.discount > 0) || false;
    
    // Get company logo and PDF images from settings
    const [logoSetting, headerImageSetting, footerImageSetting] = await Promise.all([
      prisma.systemSettings.findFirst({ where: { key: 'company_logo' } }),
      prisma.systemSettings.findFirst({ where: { key: 'pdf_header_image' } }),
      prisma.systemSettings.findFirst({ where: { key: 'pdf_footer_image' } })
    ]);
    
    // Get the origin URL from the request for absolute image URLs
    const origin = request.headers.get('origin') || request.headers.get('host') || 'http://localhost:3000';
    const baseUrl = origin.startsWith('http') ? origin : `http://${origin}`;
    
    // Convert relative paths to absolute URLs
    const convertToAbsoluteUrl = (path: string | null): string | null => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://')) return path;
      return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    };
    
    const customLogo = convertToAbsoluteUrl(logoSetting?.value || null);
    const pdfHeaderImage = convertToAbsoluteUrl(headerImageSetting?.value || null);
    const pdfFooterImage = convertToAbsoluteUrl(footerImageSetting?.value || null);

    const headerMargin = pdfHeaderImage ? '160px' : '0';
    const footerMargin = pdfFooterImage ? '160px' : '0';

    // Get invoice currency (default to GHS if not set)
    const invoiceCurrency = (invoiceData.currency as string) || 'GHS';
    const currencySymbol = getCurrencySymbol(invoiceCurrency);
    const formatCurrency = (amount: number) =>
      `${currencySymbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Generate HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.number}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          @page {
            margin: 0;
            size: A4;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
            padding: 0;
            margin: 0;
          }
          
          body > *:first-child {
            margin-top: 0;
            padding-top: 0;
          }
          
          .pdf-header {
            width: 100%;
            margin: 0;
            padding: 0;
            background: white;
            page-break-after: avoid;
            line-height: 0;
          }
          
          .pdf-header img {
            width: 100%;
            max-height: 150px;
            object-fit: cover;
            display: block;
            margin: 0;
            padding: 0;
            vertical-align: top;
          }
          
          .pdf-footer {
            width: 100%;
            margin-left: 0;
            margin-right: 0;
            padding-left: 0;
            padding-right: 0;
            background: white;
            page-break-before: avoid;
          }
          
          .pdf-footer img {
            width: 100%;
            max-height: 150px;
            object-fit: cover;
            display: block;
          }
          
          .content-wrapper {
            padding: 0 20px 20px 20px;
            margin-top: 0;
            padding-top: 25px;
            margin-bottom: 0;
          }
          
          .pdf-header + .content-wrapper {
            margin-top: 0;
            padding-top: 25px;
          }
          
          @media print {
            .pdf-header {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              width: 100%;
            }
            .pdf-footer {
              position: fixed;
              bottom: 0;
              left: 0;
              right: 0;
              width: 100%;
            }
            .content-wrapper {
              margin-top: ${headerMargin};
              margin-bottom: ${footerMargin};
            }
          }
          
          .company-header {
            text-align: center;
            margin-bottom: 15px;
            margin-top: 0;
            padding-top: 0;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 10px;
            line-height: 1.2;
          }
          
          .logo {
            max-height: 60px;
            margin: 0 auto;
            padding: 0;
            display: block;
            vertical-align: top;
          }
          
          .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 5px;
          }
          
          .document-subtitle {
            font-size: 14px;
            color: #6b7280;
            font-weight: 500;
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .info-label {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
          }
          
          .info-sub {
            font-size: 14px;
            color: #6b7280;
          }
          
          .info-sub-label {
            font-weight: 500;
            margin-bottom: 2px;
          }
          
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
          }
          
          .status-draft {
            background-color: #fef3c7;
            color: #92400e;
          }
          
          .status-sent {
            background-color: #dbeafe;
            color: #1e40af;
          }
          
          .status-overdue {
            background-color: #fee2e2;
            color: #991b1b;
          }
          
          .status-void {
            background-color: #f3f4f6;
            color: #6b7280;
          }
          
          .payment-status-unpaid {
            background-color: #fee2e2;
            color: #991b1b;
          }
          
          .payment-status-partially_paid {
            background-color: #fef3c7;
            color: #92400e;
          }
          
          .payment-status-paid {
            background-color: #d1fae5;
            color: #065f46;
          }
          
          .items-section {
            margin-bottom: 30px;
          }
          
          .items-label {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 15px;
          }
          
          .table-container {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
          }
          
          .table-header {
            display: grid;
            grid-template-columns: 30px 0.8fr 45px 110px ${hasDiscounts ? '65px' : ''} 120px;
            background-color: #f9fafb;
            font-weight: 600;
            font-size: 12px;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .table-header-cell {
            padding: 8px 6px;
            border-right: 1px solid #e5e7eb;
            font-size: 11px;
          }
          
          .table-header-cell:last-child {
            border-right: none;
          }
          
          .table-body {
            background: white;
          }
          
          .table-row {
            display: grid;
            grid-template-columns: 30px 0.8fr 45px 110px ${hasDiscounts ? '65px' : ''} 120px;
            border-bottom: 1px solid #f3f4f6;
            font-size: 13px;
          }
          
          .table-row:last-child {
            border-bottom: none;
          }
          
          .row-number {
            padding: 8px 4px;
            text-align: center;
            color: #6b7280;
            border-right: 1px solid #f3f4f6;
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
          
          .payment-info {
            background-color: transparent;
            padding: 0;
            border-radius: 0;
            margin-bottom: 0;
          }
          
          .payment-info h3 {
            display: none;
          }
          
          .payment-info p {
            font-size: 14px;
            color: #6b7280;
            margin-bottom: 4px;
          }
          
          .payment-info .info-label {
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          
          .payment-info .info-value {
            font-size: 16px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 8px;
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
            font-size: 14px;
            color: #6b7280;
            line-height: 1.6;
            white-space: pre-wrap;
          }
          
          @media print {
            body {
              padding: 0;
            }
            .pdf-header, .pdf-footer {
              display: block !important;
            }
          }
        </style>
      </head>
      <body>
        ${pdfHeaderImage ? `<div class="pdf-header"><img src="${pdfHeaderImage}" alt="PDF Header" /></div>` : ''}<div class="content-wrapper"><div class="company-header">
          ${customLogo ? `<img src="${customLogo}" alt="Company Logo" class="logo" />` : ''}
          <div class="company-name">${invoice.subject || 'Untitled Invoice'}</div>
          <div class="document-subtitle">${invoice.number}</div>
        </div>

        <!-- Document Info Grid -->
        <div class="info-grid">
          <div>
            <div class="info-label">INVOICE</div>
            <div class="info-value">${invoice.number}</div>
            <div class="info-sub">
              <div class="info-sub-label">Due Date</div>
              <div>${new Date(invoice.dueDate as any).toLocaleDateString()}</div>
            </div>
          </div>
          <div>
            <div class="info-label">DATE</div>
            <div class="info-value">${new Date(invoice.issueDate as any).toLocaleDateString()}</div>
            <div class="info-sub">
              <div class="info-sub-label">Status</div>
              <div>
                <span class="status-badge status-${(invoice.status as any).toLowerCase()}">
                  ${(invoice.status as any).toLowerCase()}
                </span>
              </div>
            </div>
          </div>
          <div>
            <div class="info-label">Bill To</div>
            <div class="info-value">${customerName}</div>
            <div class="info-sub">
              <div>${customerEmail}</div>
              <div>${customerPhone}</div>
            </div>
          </div>
          <div>
            <div class="info-label">Payment Information</div>
            <div class="info-value">
              <span class="status-badge payment-status-${(invoice.paymentStatus as any).toLowerCase()}">${(invoice.paymentStatus as any).toLowerCase().replace('_', ' ')}</span>
            </div>
            <div class="info-sub">
              <div class="info-sub-label">Amount Due</div>
              <div>${formatCurrency(Number(invoice.amountDue as any))}</div>
              ${invoiceData.amountPaid > 0 ? `
                <div class="info-sub-label" style="margin-top: 4px;">Amount Paid</div>
                <div>${formatCurrency(invoiceData.amountPaid)}</div>
              ` : ''}
              ${invoice.paymentTerms ? `
                <div class="info-sub-label" style="margin-top: 4px;">Payment Terms</div>
                <div>${invoice.paymentTerms}</div>
              ` : ''}
          </div>
        </div>
        </div>

        <!-- Items Section -->
        <div class="items-section">
          <div class="items-label">Items</div>
          ${invoice.lines && invoice.lines.length > 0 ? `
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
                ${invoice.lines.map((line: any, index: number) => `
                  <div class="table-row">
                    <div class="row-number">${index + 1}</div>
                    <div class="row-description">
                      ${(() => {
                        const images = parseProductImages(line.product?.images);
                        const imageUrl = images.length > 0 ? images[0] : '';
                        return imageUrl 
                          ? `<img src="${imageUrl}" alt="Product" class="product-image" onerror="this.style.display='none'" />` 
                          : '';
                      })()}
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
                `).join('')}
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
          ${!invoiceData.taxInclusive ? `
            <div class="total-row">
              <span class="total-label">Subtotal:</span>
              <span class="total-value">${formatCurrency(invoiceData.subtotal)}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Tax:</span>
              <span class="total-value">${formatCurrency(invoiceData.tax)}</span>
            </div>
          ` : ''}
          <div class="total-row total-final">
            <span>${invoiceData.taxInclusive ? 'Total (Tax Inclusive):' : 'Total:'}</span>
            <span class="total-black">${formatCurrency(invoiceData.total)}</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="notes-section">
            <div class="notes-title">Notes</div>
            <div class="notes-content">${invoice.notes}</div>
          </div>
        ` : ''}
        </div>
        
        ${pdfFooterImage ? `<div class="pdf-footer"><img src="${pdfFooterImage}" alt="PDF Footer" /></div>` : ''}
      </body>
      </html>
    `;

    // Return HTML content that can be converted to PDF
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

  } catch (error) {
    console.error('❌ Invoice PDF API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF' },
      { status: 500 }
    );
  }
}
