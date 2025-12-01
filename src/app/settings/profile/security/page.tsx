"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { ArrowLeft, History, Shield, CheckCircle, XCircle, MapPin, Monitor, Globe } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface LoginHistoryItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  device: string | null;
  location: string | null;
  isSuccessful: boolean;
  failureReason: string | null;
  createdAt: string;
}

export default function SecurityPage() {
  const { data: session } = useSession();
  const { error: showError } = useToast();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();

  const [loading, setLoading] = useState(true);
  const [loginHistory, setLoginHistory] = useState<LoginHistoryItem[]>([]);

  useEffect(() => {
    if (session?.user) {
      fetchLoginHistory();
    }
  }, [session]);

  const fetchLoginHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/profile/login-history", {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch login history");
      }

      const data = await response.json();
      setLoginHistory(data.history || []);
    } catch (error) {
      console.error("Error fetching login history:", error);
      showError(error instanceof Error ? error.message : "Failed to load login history");
    } finally {
      setLoading(false);
    }
  };

  const getDeviceInfo = (userAgent: string | null) => {
    if (!userAgent) return "Unknown device";
    
    // Simple device detection
    if (userAgent.includes("Mobile")) {
      return "Mobile Device";
    } else if (userAgent.includes("Tablet")) {
      return "Tablet";
    } else {
      return "Desktop";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex items-center space-x-4">
        <Link href="/settings/profile">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
            <Shield className="h-8 w-8 mr-3" />
            Login History
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View recent login attempts and account activity
          </p>
        </div>
      </div>

      {/* Login History */}
      <Card className={theme.card}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            Recent Login Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loginHistory.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No login history available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {loginHistory.map((login) => (
                <div
                  key={login.id}
                  className={`p-4 rounded-lg border ${
                    login.isSuccessful
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {login.isSuccessful ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <span
                          className={`font-medium ${
                            login.isSuccessful ? "text-green-900" : "text-red-900"
                          }`}
                        >
                          {login.isSuccessful ? "Successful Login" : "Failed Login"}
                        </span>
                        {!login.isSuccessful && login.failureReason && (
                          <span className="text-sm text-red-700">
                            ({login.failureReason})
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center space-x-2 text-gray-700">
                          <Monitor className="h-4 w-4 text-gray-500" />
                          <span>
                            <strong>Device:</strong> {getDeviceInfo(login.userAgent)}
                          </span>
                        </div>
                        {login.ipAddress && (
                          <div className="flex items-center space-x-2 text-gray-700">
                            <Globe className="h-4 w-4 text-gray-500" />
                            <span>
                              <strong>IP Address:</strong> {login.ipAddress}
                            </span>
                          </div>
                        )}
                        {login.location && (
                          <div className="flex items-center space-x-2 text-gray-700">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span>
                              <strong>Location:</strong> {login.location}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center space-x-2 text-gray-700">
                          <History className="h-4 w-4 text-gray-500" />
                          <span>
                            <strong>Time:</strong> {formatDate(login.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

