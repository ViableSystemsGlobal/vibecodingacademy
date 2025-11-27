import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Sparkles, Mail } from "lucide-react";

interface GenerateAiReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function GenerateAiReportModal({
  isOpen,
  onClose,
  projectId,
  projectName,
}: GenerateAiReportModalProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [email, setEmail] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClose = () => {
    setEmail("");
    onClose();
  };

  const handleGenerate = async () => {
    if (!email.trim()) {
      showError("Error", "Please enter an email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = email.split(",").map(e => e.trim()).filter(e => e);
    
    const invalidEmails = emails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      showError("Error", `Invalid email address(es): ${invalidEmails.join(", ")}`);
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/generate-ai-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emails: emails,
        }),
      });

      if (!response.ok) {
        let errorData: any = null;
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
          } catch (parseError) {
            console.error("Failed to parse JSON error response:", parseError);
          }
        } else {
          // Try to read as text if not JSON
          try {
            const text = await response.text();
            console.error("Non-JSON error response:", text);
            errorData = { error: text || `HTTP ${response.status}: ${response.statusText}` };
          } catch (textError) {
            console.error("Failed to read error response:", textError);
          }
        }
        
        const errorMessage = errorData?.error || errorData?.details;
        const statusText = response.statusText || `HTTP ${response.status}`;
        
        if (errorMessage && typeof errorMessage === 'string' && errorMessage.trim()) {
          console.error(`[AI-REPORT] Failed: ${errorMessage} (${statusText})`);
          throw new Error(errorMessage);
        } else {
          console.error(`[AI-REPORT] Failed: ${statusText}`);
          throw new Error(`Failed to generate AI report (${statusText})`);
        }
      }

      success("AI report is being generated and will be sent to the provided email(s)");
      handleClose();
    } catch (error: any) {
      console.error("Error generating AI report:", error);
      showError("Error", error.message || "Failed to generate AI report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generate AI Report
          </DialogTitle>
          <DialogDescription>
            AI will analyze the project data and generate a comprehensive report. The report will be sent to the email address(es) you provide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="email">Email Address(es) *</Label>
            <Input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com, another@example.com"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter comma-separated email addresses to send the report to
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Project:</strong> {projectName}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              The AI will analyze tasks, incidents, resource requests, and project progress to generate insights.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isGenerating}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !email.trim()}
            className="flex items-center gap-2"
            style={{
              backgroundColor: getThemeColor(),
              color: "white",
            }}
          >
            {isGenerating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate & Send Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

