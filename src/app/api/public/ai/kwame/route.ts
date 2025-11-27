import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIService, KWAME_PROMPT } from "@/lib/ai-service";
import { getCompanyName } from "@/lib/payment-order-notifications";

type ChatRole = "user" | "assistant";

interface ConversationTurn {
  role: ChatRole;
  content: string;
}

interface LeadPayload {
  leadId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

function sanitizeConversation(history: unknown): ConversationTurn[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map((turn) => {
      if (
        turn &&
        typeof turn === "object" &&
        (turn as ConversationTurn).role &&
        (turn as ConversationTurn).content
      ) {
        const role = (turn as ConversationTurn).role;
        if (role !== "user" && role !== "assistant") {
          return null;
        }

        return {
          role,
          content: String((turn as ConversationTurn).content).slice(0, 2000),
        };
      }
      return null;
    })
    .filter((turn): turn is ConversationTurn => Boolean(turn))
    .slice(-12);
}

function buildLeadContext(lead?: LeadPayload | null): string {
  if (!lead) {
    return "";
  }

  const parts: string[] = [];
  if (lead.firstName || lead.lastName) {
    parts.push(
      `Customer name: ${(lead.firstName ?? "").trim()} ${(lead.lastName ?? "").trim()}`.trim()
    );
  }
  if (lead.email) {
    parts.push(`Email: ${lead.email}`);
  }
  if (lead.phone) {
    parts.push(`Phone: ${lead.phone}`);
  }
  if (lead.leadId) {
    parts.push(`Lead record ID: ${lead.leadId}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `\n\nKnown customer details:\n${parts.join("\n")}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory, lead } = body ?? {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { success: false, error: "Ask a question so Kwame can help." },
        { status: 400 }
      );
    }

    const sanitizedHistory = sanitizeConversation(conversationHistory);

    const companyName = (await getCompanyName()) ?? "AdPools Group";

    const aiSettings = await prisma.systemSettings.findMany({
      where: {
        key: {
          in: [
            "ai_provider",
            "ai_openai_api_key",
            "ai_anthropic_api_key",
            "ai_gemini_api_key",
            "ai_model",
            "ai_temperature",
            "ai_max_tokens",
          ],
        },
      },
    });

    const settingsMap = aiSettings.reduce<Record<string, string>>((acc, setting) => {
      acc[setting.key] = setting.value ?? "";
      return acc;
    }, {});

    const provider = settingsMap.ai_provider || "openai";
    const apiKey = settingsMap[`ai_${provider}_api_key`];

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: `${provider} API key not configured. Please contact support.`,
        },
        { status: 503 }
      );
    }

    const promptWithContext =
      KWAME_PROMPT.replace(/AdPools Group/g, companyName) + buildLeadContext(lead);

    const aiService = new AIService({
      provider,
      openaiApiKey: settingsMap.ai_openai_api_key,
      anthropicApiKey: settingsMap.ai_anthropic_api_key,
      geminiApiKey: settingsMap.ai_gemini_api_key,
      model: settingsMap.ai_model || "gpt-4o-mini",
      temperature: parseFloat(settingsMap.ai_temperature || "0.7"),
      maxTokens: parseInt(settingsMap.ai_max_tokens || "800", 10),
    });

    const aiResponse = await aiService.generateResponse(
      message,
      {},
      sanitizedHistory,
      promptWithContext
    );

    return NextResponse.json({
      success: true,
      response: {
        text: aiResponse.text,
        chart: aiResponse.chart,
      },
    });
  } catch (error) {
    console.error("❌ Public Kwame API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Kwame couldn't respond right now. Please try again shortly or contact support.",
      },
      { status: 500 }
    );
  }
}


