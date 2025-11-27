import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettingValue } from "@/lib/utils";
import { generateEmailTemplate } from "@/lib/email-template";
import nodemailer from "nodemailer";

async function getCompanyName(): Promise<string> {
  return (await getSettingValue("company_name", "Company")) || "Company";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log("[AI-REPORT] Starting report generation...");
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error("[AI-REPORT] Unauthorized - no session");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    console.log("[AI-REPORT] Project ID:", projectId);
    const body = await request.json();
    const { emails } = body;
    console.log("[AI-REPORT] Emails received:", emails);

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      console.error("[AI-REPORT] No emails provided");
      return NextResponse.json(
        { error: "At least one email address is required" },
        { status: 400 }
      );
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter((email: string) => !emailRegex.test(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { error: `Invalid email address(es): ${invalidEmails.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch project with all related data
    console.log("[AI-REPORT] Fetching project data...");
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        tasks: {
          select: {
            id: true,
            status: true,
            dueDate: true,
          },
        },
        incidents: {
          select: {
            id: true,
            status: true,
          },
        },
        resourceRequests: {
          select: {
            id: true,
            status: true,
          },
        },
        members: {
          select: {
            id: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!project) {
      console.error("[AI-REPORT] Project not found:", projectId);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    console.log("[AI-REPORT] Project found:", project.name);
    console.log("[AI-REPORT] Tasks:", project.tasks?.length || 0);
    console.log("[AI-REPORT] Incidents:", project.incidents?.length || 0);
    console.log("[AI-REPORT] Resource Requests:", project.resourceRequests?.length || 0);

    // Calculate statistics with null checks
    const tasks = project.tasks || [];
    const incidents = project.incidents || [];
    const resourceRequests = project.resourceRequests || [];
    const members = project.members || [];

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const inProgressTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pendingTasks = tasks.filter((t) => t.status === "PENDING").length;
    const overdueTasks = tasks.filter((t) => {
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < new Date() && t.status !== "COMPLETED";
    }).length;

    const totalIncidents = incidents.length;
    const resolvedIncidents = incidents.filter((i) => i.status === "RESOLVED").length;
    const openIncidents = incidents.filter((i) => i.status === "OPEN").length;

    const totalResourceRequests = resourceRequests.length;
    const approvedRequests = resourceRequests.filter(
      (r) => r.status === "APPROVED" || r.status === "FULFILLED"
    ).length;
    const pendingRequests = resourceRequests.filter((r) => r.status === "DRAFT" || r.status === "SUBMITTED").length;

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    const incidentResolutionRate = totalIncidents > 0 ? (resolvedIncidents / totalIncidents) * 100 : 0;

    // Generate AI analysis (simplified - you can integrate with OpenAI API here)
    const analysis = generateProjectAnalysis({
      project,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overdueTasks,
      totalIncidents,
      resolvedIncidents,
      openIncidents,
      totalResourceRequests,
      approvedRequests,
      pendingRequests,
      completionRate,
      incidentResolutionRate,
    });

    const companyName = await getCompanyName();
    console.log("[AI-REPORT] Company name:", companyName);

    // Get SMTP configuration
    console.log("[AI-REPORT] Fetching SMTP configuration...");
    const smtpHost = await getSettingValue("SMTP_HOST", "");
    const smtpPort = await getSettingValue("SMTP_PORT", "587");
    const smtpUsername = await getSettingValue("SMTP_USERNAME", "");
    const smtpPassword = await getSettingValue("SMTP_PASSWORD", "");
    const smtpFromAddress = await getSettingValue("SMTP_FROM_ADDRESS", "");
    const smtpFromName = await getSettingValue("SMTP_FROM_NAME", await getCompanyName());
    const smtpEncryption = await getSettingValue("SMTP_ENCRYPTION", "tls");

    if (!smtpHost || !smtpUsername || !smtpPassword || !smtpFromAddress) {
      console.error("[AI-REPORT] SMTP configuration missing:", {
        hasHost: !!smtpHost,
        hasUsername: !!smtpUsername,
        hasPassword: !!smtpPassword,
        hasFromAddress: !!smtpFromAddress,
      });
      return NextResponse.json(
        { error: "SMTP configuration not found. Please configure email settings." },
        { status: 500 }
      );
    }

    console.log("[AI-REPORT] SMTP configuration found, creating transporter...");

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

    // Generate email content
    const emailContent = generateReportContent(project, analysis, {
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overdueTasks,
      totalIncidents,
      resolvedIncidents,
      openIncidents,
      totalResourceRequests,
      approvedRequests,
      pendingRequests,
      completionRate,
      incidentResolutionRate,
      membersCount: members.length,
    });

    // Use the standard email template
    const emailHtml = await generateEmailTemplate(emailContent);

    // Send email
    console.log("[AI-REPORT] Sending email to:", emails.join(", "));
    await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromAddress}>`,
      to: emails.join(", "),
      subject: `AI Project Report: ${project.name}`,
      html: emailHtml,
    });

    console.log("[AI-REPORT] Email sent successfully");
    return NextResponse.json({
      success: true,
      message: `AI report sent to ${emails.length} recipient(s)`,
    });
  } catch (error) {
    console.error("Error generating AI report:", error);
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      name: error instanceof Error ? error.name : "Unknown",
    });
    return NextResponse.json(
      {
        error: "Failed to generate AI report",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

function generateProjectAnalysis(data: any): string {
  const {
    completionRate,
    incidentResolutionRate,
    overdueTasks,
    openIncidents,
    pendingRequests,
  } = data;

  let analysis = `# Project Analysis Report\n\n`;

  // Overall Health
  analysis += `## Overall Project Health\n\n`;
  if (completionRate >= 80) {
    analysis += `✅ **Excellent Progress**: The project is ${completionRate.toFixed(1)}% complete, indicating strong momentum.\n\n`;
  } else if (completionRate >= 50) {
    analysis += `⚠️ **Moderate Progress**: The project is ${completionRate.toFixed(1)}% complete. Consider reviewing task priorities and resource allocation.\n\n`;
  } else {
    analysis += `🔴 **Needs Attention**: The project is only ${completionRate.toFixed(1)}% complete. Immediate action may be required to meet deadlines.\n\n`;
  }

  // Task Analysis
  analysis += `## Task Analysis\n\n`;
  if (overdueTasks > 0) {
    analysis += `⚠️ **${overdueTasks} overdue task(s)** detected. These require immediate attention to prevent project delays.\n\n`;
  } else {
    analysis += `✅ **No overdue tasks**. All tasks are on schedule.\n\n`;
  }

  // Incident Analysis
  analysis += `## Incident Management\n\n`;
  if (incidentResolutionRate >= 80) {
    analysis += `✅ **Strong Incident Resolution**: ${incidentResolutionRate.toFixed(1)}% of incidents have been resolved, indicating effective problem-solving.\n\n`;
  } else if (openIncidents > 0) {
    analysis += `⚠️ **${openIncidents} open incident(s)** require attention. Focus on resolving critical incidents first.\n\n`;
  } else {
    analysis += `✅ **No open incidents**. All incidents have been resolved.\n\n`;
  }

  // Resource Requests
  analysis += `## Resource Management\n\n`;
  if (pendingRequests > 0) {
    analysis += `📋 **${pendingRequests} pending resource request(s)**. Review and prioritize resource allocation.\n\n`;
  } else {
    analysis += `✅ **All resource requests processed**. No pending requests.\n\n`;
  }

  // Recommendations
  analysis += `## Recommendations\n\n`;
  if (overdueTasks > 0) {
    analysis += `1. **Address Overdue Tasks**: Review and reassign overdue tasks to ensure project timeline.\n`;
  }
  if (openIncidents > 0) {
    analysis += `2. **Resolve Open Incidents**: Prioritize critical incidents to maintain project quality.\n`;
  }
  if (completionRate < 50) {
    analysis += `3. **Accelerate Progress**: Consider increasing team capacity or adjusting project scope.\n`;
  }
  if (pendingRequests > 0) {
    analysis += `4. **Process Resource Requests**: Review pending resource requests to avoid bottlenecks.\n`;
  }

  return analysis;
}

function generateReportContent(project: any, analysis: string, stats: any): string {
  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Convert markdown-style analysis to HTML
  const analysisHtml = analysis
    .replace(/^# (.+)$/gm, '<h2 style="color: #333; margin-top: 20px; margin-bottom: 10px;">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="color: #555; margin-top: 15px; margin-bottom: 8px;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p style="margin: 10px 0;">')
    .replace(/^(.+)$/gm, '<p style="margin: 10px 0;">$1</p>');

  return `
    <h1 style="color: #333; margin-bottom: 20px;">🤖 AI Project Analysis Report</h1>
    
    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
      <p style="margin: 5px 0;"><strong>Project:</strong> ${project.name}</p>
      <p style="margin: 5px 0;"><strong>Generated:</strong> ${reportDate}</p>
    </div>

    <h2 style="color: #333; margin-top: 30px; margin-bottom: 15px;">📊 Key Metrics</h2>
    
    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.totalTasks}</div>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">Total Tasks</div>
        <div style="font-size: 11px; color: #888; margin-top: 3px;">${stats.completedTasks} completed (${stats.completionRate.toFixed(1)}%)</div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.totalIncidents}</div>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">Total Incidents</div>
        <div style="font-size: 11px; color: #888; margin-top: 3px;">${stats.resolvedIncidents} resolved (${stats.incidentResolutionRate.toFixed(1)}%)</div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.totalResourceRequests}</div>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">Resource Requests</div>
        <div style="font-size: 11px; color: #888; margin-top: 3px;">${stats.approvedRequests} approved</div>
      </div>
      
      <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea;">
        <div style="font-size: 24px; font-weight: bold; color: #667eea;">${stats.membersCount || 0}</div>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">Team Members</div>
      </div>
    </div>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e0e0e0;">
      <h3 style="color: #333; margin-top: 0;">📈 Detailed Statistics</h3>
      <ul style="line-height: 1.8;">
        <li><strong>Tasks in Progress:</strong> ${stats.inProgressTasks}</li>
        <li><strong>Pending Tasks:</strong> ${stats.pendingTasks}</li>
        <li><strong>Overdue Tasks:</strong> ${stats.overdueTasks}</li>
        <li><strong>Open Incidents:</strong> ${stats.openIncidents}</li>
        <li><strong>Pending Resource Requests:</strong> ${stats.pendingRequests}</li>
      </ul>
    </div>

    <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h3 style="color: #333; margin-top: 0;">🔍 AI Analysis</h3>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif; line-height: 1.6;">
        ${analysisHtml}
      </div>
    </div>

    <p style="color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
      This report was automatically generated by AI analysis.
    </p>
  `;
}

