// This function doesn't use hooks directly - it accepts the necessary parameters

interface Quotation {
  id: string;
  number: string;
  status: string;
  subject: string;
  validUntil: string;
  notes?: string;
  subtotal: number;
  tax: number;
  total: number;
  taxInclusive?: boolean;
  accountId?: string;
  distributorId?: string;
  leadId?: string;
  customerType: string;
  createdAt: string;
  updatedAt: string;
  account?: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  distributor?: {
    id: string;
    businessName: string;
    email: string;
    phone: string;
  };
  lead?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    company: string;
  };
  owner: {
    id: string;
    name: string;
    email: string;
  };
  lines: Array<{
    id: string;
    productId?: string;
    productName: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    product?: {
      name: string;
      sku?: string;
      images?: string | null;
    };
    images?: string | null;
  }>;
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

// Version 3.0 - Open window synchronously to avoid popup blocker
export const downloadQuotationAsPDF = async (
  quotation: any, 
  customLogo?: string,
  showError?: (message: string) => void,
  success?: (message: string) => void
) => {
  const VERSION = '3.0.0';
  console.log(`[Quotation PDF Download v${VERSION}] Starting download for quotation ${quotation?.id}`);
  
  const errorHandler = showError || ((message: string) => console.error(message));
  const successHandler = success || ((message: string) => console.log(message));
  
  // Validate quotation object
  if (!quotation || !quotation.id) {
    errorHandler('Invalid quotation data');
    return;
  }
  
  try {
    // Open window SYNCHRONOUSLY (in response to user click) to avoid popup blocker
    // This must happen immediately, without any async operations
    const timestamp = Date.now();
    const pdfUrl = `/api/quotations/${quotation.id}/pdf?t=${timestamp}&v=${VERSION}`;
    
    console.log(`[Quotation PDF Download] Opening window synchronously`);
    
    // Open window immediately with the URL - this must be synchronous
    const newWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');
    
    if (!newWindow) {
      console.error('[Quotation PDF Download] Popup blocked');
      errorHandler('Please allow popups to view the PDF, or try clicking the download button again.');
      return;
    }
    
    console.log(`[Quotation PDF Download] PDF opened successfully`);
    successHandler("Quotation PDF opened in new tab. You can print it from there.");
    
  } catch (error) {
    console.error('[Quotation PDF Download] Error:', error);
    errorHandler('Failed to download quotation. Please try again.');
  }
};
