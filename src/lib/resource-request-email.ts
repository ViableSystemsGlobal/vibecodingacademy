import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";
import jsPDF from "jspdf";

async function getSettingValue(key: string, defaultValue: string = ""): Promise<string> {
  try {
    const setting = await prisma.systemSettings.findFirst({
      where: { key },
    });
    return setting?.value || defaultValue;
  } catch (error) {
    return defaultValue;
  }
}

async function getCompanyName(): Promise<string> {
  return await getSettingValue("company_name", "AdPools Group");
}

/**
 * Generate PDF for resource request
 */
export async function generateResourceRequestPDF(resourceRequest: any, project: any, requester: any): Promise<Buffer> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  let yPosition = 20;

  // Get company logo (optional - skip if not available)
  const companyName = await getCompanyName();
  
  // Try to add logo if available (skip if it fails)
  try {
    const logoSetting = await prisma.systemSettings.findFirst({
      where: { key: "company_logo" },
    });
    
    if (logoSetting?.value && (logoSetting.value.startsWith("http://") || logoSetting.value.startsWith("https://"))) {
      const logoResponse = await fetch(logoSetting.value);
      if (logoResponse.ok) {
        const logoBlob = await logoResponse.blob();
        const logoBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(logoBlob);
        });
        pdf.addImage(logoBase64, "PNG", 150, 15, 40, 15);
      }
    }
  } catch (error) {
    // Logo is optional - continue without it
    console.log("Logo not available, continuing without logo");
  }

  // Header
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("RESOURCE REQUEST", 20, yPosition);
  yPosition += 15;

  // Request Details
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");

  // Request Number
  pdf.setFont("helvetica", "bold");
  pdf.text("Request ID:", 20, yPosition);
  pdf.setFont("helvetica", "normal");
  pdf.text(resourceRequest.id.substring(0, 12), 60, yPosition);
  yPosition += 8;

  // Project
  pdf.setFont("helvetica", "bold");
  pdf.text("Project:", 20, yPosition);
  pdf.setFont("helvetica", "normal");
  pdf.text(project.name || "N/A", 60, yPosition);
  yPosition += 8;

  // Requested By
  pdf.setFont("helvetica", "bold");
  pdf.text("Requested By:", 20, yPosition);
  pdf.setFont("helvetica", "normal");
  pdf.text(requester.name || requester.email || "N/A", 60, yPosition);
  yPosition += 8;

  // Request Date
  pdf.setFont("helvetica", "bold");
  pdf.text("Request Date:", 20, yPosition);
  pdf.setFont("helvetica", "normal");
  pdf.text(new Date(resourceRequest.createdAt).toLocaleDateString(), 60, yPosition);
  yPosition += 8;

  // Needed By
  if (resourceRequest.neededBy) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Needed By:", 20, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(new Date(resourceRequest.neededBy).toLocaleDateString(), 60, yPosition);
    yPosition += 8;
  }

  yPosition += 5;

  // Title
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Request Title", 20, yPosition);
  yPosition += 10;

  // Title
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  const titleLines = pdf.splitTextToSize(resourceRequest.title || "N/A", 150);
  pdf.text(titleLines, 20, yPosition);
  yPosition += titleLines.length * 6 + 10;

  // Items/Products Section
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Requested Items", 20, yPosition);
  yPosition += 10;

  // Check if we have items array (new format) or legacy single item
  const items = (resourceRequest as any).items || [];
  const hasItems = items.length > 0;

  if (hasItems) {
    // New format: Multiple items
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    
    // Table header
    pdf.text("Product Name", 20, yPosition);
    pdf.text("Quantity", 100, yPosition);
    pdf.text("Unit", 140, yPosition);
    yPosition += 8;
    
    pdf.setFont("helvetica", "normal");
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, yPosition - 2, 190, yPosition - 2);
    yPosition += 5;

    items.forEach((item: any) => {
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        yPosition = 20;
      }

      const productName = item.productName || item.product?.name || "N/A";
      const quantity = item.quantity || 0;
      const unit = item.unit || "unit";

      pdf.text(productName.substring(0, 40), 20, yPosition);
      pdf.text(String(quantity), 100, yPosition);
      pdf.text(unit, 140, yPosition);
      yPosition += 8;
    });
  } else {
    // Legacy format: Single item (backward compatibility)
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");

    if (resourceRequest.sku) {
      pdf.setFont("helvetica", "bold");
      pdf.text("SKU:", 20, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(resourceRequest.sku, 60, yPosition);
      yPosition += 8;
    }

    pdf.setFont("helvetica", "bold");
    pdf.text("Quantity:", 20, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${resourceRequest.quantity} ${resourceRequest.unit || "unit"}`, 60, yPosition);
    yPosition += 8;
  }

  yPosition += 5;

  // Priority
  pdf.setFont("helvetica", "bold");
  pdf.text("Priority:", 20, yPosition);
  pdf.setFont("helvetica", "normal");
  pdf.text(resourceRequest.priority || "NORMAL", 60, yPosition);
  yPosition += 8;

  // Assigned Team
  pdf.setFont("helvetica", "bold");
  pdf.text("Assigned Team:", 20, yPosition);
  pdf.setFont("helvetica", "normal");
  pdf.text(resourceRequest.assignedTeam || "N/A", 60, yPosition);
  yPosition += 8;

  // Estimated Cost
  if (resourceRequest.estimatedCost) {
    pdf.setFont("helvetica", "bold");
    pdf.text("Estimated Cost:", 20, yPosition);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${resourceRequest.currency || "USD"} ${resourceRequest.estimatedCost.toFixed(2)}`, 60, yPosition);
    yPosition += 8;
  }

  yPosition += 5;

  // Details
  if (resourceRequest.details) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Additional Details", 20, yPosition);
    yPosition += 10;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const detailsLines = pdf.splitTextToSize(resourceRequest.details, 170);
    pdf.text(detailsLines, 20, yPosition);
    yPosition += detailsLines.length * 6 + 10;
  }

  // Footer
  const footerY = pageHeight - 20;
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "italic");
  pdf.text(`Generated on ${new Date().toLocaleString()}`, 20, footerY);
  pdf.text(companyName, pageWidth - 60, footerY);

  // Convert to buffer
  const pdfBlob = pdf.output("blob");
  const arrayBuffer = await pdfBlob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Send resource request email with PDF attachment to procurement team
 */
export async function sendResourceRequestEmail(
  resourceRequest: any,
  project: any,
  requester: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get email recipients - use request's emailTo/emailCc if provided, otherwise fallback to settings
    let emailTo: string[] = [];
    let emailCc: string[] = [];

    if (resourceRequest.emailTo) {
      emailTo = resourceRequest.emailTo
        .split(",")
        .map((email: string) => email.trim())
        .filter((email: string) => email.length > 0);
    }

    if (resourceRequest.emailCc) {
      emailCc = resourceRequest.emailCc
        .split(",")
        .map((email: string) => email.trim())
        .filter((email: string) => email.length > 0);
    }

    // Fallback to procurement email from settings if no emailTo provided
    if (emailTo.length === 0) {
      const procurementEmail = await getSettingValue(
        "PROCUREMENT_EMAIL",
        await getSettingValue("SMTP_FROM_ADDRESS", "")
      );
      if (procurementEmail) {
        emailTo = [procurementEmail];
      }
    }

    if (emailTo.length === 0) {
      return {
        success: false,
        error: "No email recipients specified. Please add email addresses in the request or configure PROCUREMENT_EMAIL in settings.",
      };
    }

    // Get SMTP configuration
    const smtpHost = await getSettingValue("SMTP_HOST", "");
    const smtpPort = await getSettingValue("SMTP_PORT", "587");
    const smtpUsername = await getSettingValue("SMTP_USERNAME", "");
    const smtpPassword = await getSettingValue("SMTP_PASSWORD", "");
    const smtpFromAddress = await getSettingValue("SMTP_FROM_ADDRESS", "");
    const smtpFromName = await getSettingValue("SMTP_FROM_NAME", await getCompanyName());
    const smtpEncryption = await getSettingValue("SMTP_ENCRYPTION", "tls");

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      return {
        success: false,
        error: "SMTP configuration not found. Please configure email settings.",
      };
    }

    // Generate PDF
    const pdfBuffer = await generateResourceRequestPDF(resourceRequest, project, requester);

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort),
      secure: smtpEncryption === "ssl",
      auth: {
        user: smtpUsername,
        pass: smtpPassword,
      },
    });

    // Prepare email content
    const subject = `Resource Request: ${resourceRequest.title} - Project: ${project.name}`;
    const emailBody = `
      <h2>New Resource Request</h2>
      <p>A new resource request has been submitted for procurement.</p>
      
      <h3>Request Details:</h3>
      <ul>
        <li><strong>Request ID:</strong> ${resourceRequest.id.substring(0, 12)}</li>
        <li><strong>Project:</strong> ${project.name}</li>
        <li><strong>Title:</strong> ${resourceRequest.title}</li>
        <li><strong>Priority:</strong> ${resourceRequest.priority || "NORMAL"}</li>
        <li><strong>Assigned Team:</strong> ${resourceRequest.assignedTeam || "N/A"}</li>
        ${resourceRequest.neededBy ? `<li><strong>Needed By:</strong> ${new Date(resourceRequest.neededBy).toLocaleDateString()}</li>` : ""}
        <li><strong>Requested By:</strong> ${requester.name || requester.email}</li>
      </ul>
      
      <h3>Requested Items:</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 10px 0;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Product Name</th>
            <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Quantity</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Unit</th>
          </tr>
        </thead>
        <tbody>
          ${((resourceRequest as any).items || []).length > 0 
            ? ((resourceRequest as any).items || []).map((item: any) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.productName || item.product?.name || "N/A"}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${item.quantity || 0}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${item.unit || "unit"}</td>
              </tr>
            `).join("")
            : `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${resourceRequest.sku || "N/A"}</td>
                <td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${resourceRequest.quantity || 0}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${resourceRequest.unit || "unit"}</td>
              </tr>
            `
          }
        </tbody>
      </table>
      
      ${resourceRequest.details ? `<p><strong>Additional Details:</strong><br>${resourceRequest.details}</p>` : ""}
      
      <p>Please see the attached PDF for complete details.</p>
      
      <p>Best regards,<br>${await getCompanyName()}</p>
    `;

    // Send email with PDF attachment
    await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: emailTo.join(", "),
      cc: emailCc.length > 0 ? emailCc.join(", ") : undefined,
      subject,
      html: emailBody,
      attachments: [
        {
          filename: `Resource-Request-${resourceRequest.id.substring(0, 8)}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    console.log(`✅ Resource request email sent to ${emailTo.join(", ")}${emailCc.length > 0 ? ` (CC: ${emailCc.join(", ")})` : ""}`);
    return { success: true };
  } catch (error) {
    console.error("Error sending resource request email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

