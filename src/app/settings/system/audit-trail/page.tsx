"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTheme } from "@/contexts/theme-context";
import { useToast } from "@/contexts/toast-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  ArrowLeft,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Clock,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type AuditLogEntry = {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
};

const ACTION_LABELS: Record<string, string> = {
  "user.created": "User created",
  "user.updated": "User updated",
  "user.password_changed": "Password changed",
  "user.activated": "User activated",
  "user.deactivated": "User deactivated",
  "lead.created": "Lead created",
  "lead.updated": "Lead updated",
  "lead.deleted": "Lead deleted",
  "account.created": "Account created",
  "account.updated": "Account updated",
  "account.deleted": "Account deleted",
  "contact.created": "Contact created",
  "contact.updated": "Contact updated",
  "contact.deleted": "Contact deleted",
  "opportunity.created": "Opportunity created",
  "opportunity.updated": "Opportunity updated",
  "opportunity.deleted": "Opportunity deleted",
  "invoice.created": "Invoice created",
  "invoice.updated": "Invoice updated",
  "invoice.deleted": "Invoice deleted",
  "quotation.created": "Quotation created",
  "quotation.updated": "Quotation updated",
  "quotation.deleted": "Quotation deleted",
};

const RESOURCE_LABELS: Record<string, string> = {
  User: "User",
  Lead: "Lead",
  Account: "Account",
  Contact: "Contact",
  Opportunity: "Opportunity",
  Invoice: "Invoice",
  Quotation: "Quotation",
};

export default function AuditTrailPage() {
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { success, error: showError } = useToast();

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [resourceFilter, setResourceFilter] = useState<string>("all");

  const fetchEntries = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const response = await fetch("/api/audit-logs");
      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }
      const data = await response.json();
      setEntries(data.logs || []);
      if (showToast) {
        success("Audit trail updated");
      }
    } catch (error) {
      console.error("Failed to load audit logs:", error);
      showError("Error", "Failed to load audit logs");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [success, showError]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesSearch =
        searchTerm.trim().length === 0 ||
        entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.resource.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.resourceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesAction =
        actionFilter === "all" || entry.action === actionFilter;

      const matchesResource =
        resourceFilter === "all" || entry.resource === resourceFilter;

      return matchesSearch && matchesAction && matchesResource;
    });
  }, [entries, searchTerm, actionFilter, resourceFilter]);

  const copyJson = async (label: string, data?: Record<string, unknown> | null) => {
    if (!data) {
      showError("Copy failed", `No ${label} to copy`);
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      success(`${label} copied to clipboard`);
    } catch (error) {
      console.error("Failed to copy JSON:", error);
      showError("Copy failed", `Failed to copy ${label}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/settings">
            <Button variant="ghost" size="sm" className="p-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className={`h-6 w-6 text-${theme.primary}`} />
              Audit Trail
            </h1>
            <p className="text-gray-600">
              Review a chronological history of all critical system events.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchEntries(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by user, action, or resource..."
                className="pl-9"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Action
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full appearance-none border rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All actions</option>
                  {Array.from(new Set(entries.map((entry) => entry.action))).map(
                    (action) => (
                      <option key={action} value={action}>
                        {ACTION_LABELS[action] || action}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Resource
              </label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                <select
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                  className="w-full appearance-none border rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="all">All resources</option>
                  {Array.from(new Set(entries.map((entry) => entry.resource))).map(
                    (resource) => (
                      <option key={resource} value={resource}>
                        {RESOURCE_LABELS[resource] || resource}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            Loading audit trail...
          </CardContent>
        </Card>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="flex flex-col items-center gap-2 text-gray-500">
              <Activity className="h-10 w-10" />
              <p className="font-medium">No audit entries found</p>
              <p className="text-sm">Try adjusting the filters or refresh to fetch the latest activity.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2">
              <Shield className={`h-5 w-5 text-${theme.primary}`} />
              Activity Log
            </CardTitle>
            <CardDescription>
              Showing {filteredEntries.length} {filteredEntries.length === 1 ? "event" : "events"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="px-6 py-5 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`bg-${theme.primaryBg} text-${theme.primary}`}>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          on {RESOURCE_LABELS[entry.resource] || entry.resource}
                          {entry.resourceId ? ` • ${entry.resourceId}` : ""}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span>
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                        {entry.ipAddress && (
                          <>
                            <span className="text-gray-300">•</span>
                            <span title="IP Address">{entry.ipAddress}</span>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                        <Shield className="h-4 w-4 text-gray-500" />
                        <span>
                          {entry.user?.name || entry.user?.email || "System"} ({entry.userId})
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {entry.oldData && (
                          <Card className="border border-gray-200 bg-white">
                            <CardHeader className="px-4 py-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span className="flex items-center gap-2 text-gray-700">
                                  <XCircle className="h-4 w-4 text-red-500" />
                                  Previous data
                                </span>
                                <button
                                  onClick={() => copyJson("Previous data", entry.oldData)}
                                  className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                                >
                                  <Copy className="h-3 w-3" /> Copy
                                </button>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 py-3 bg-gray-50 rounded-b-lg">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">
                                {JSON.stringify(entry.oldData, null, 2)}
                              </pre>
                            </CardContent>
                          </Card>
                        )}

                        {entry.newData && (
                          <Card className="border border-gray-200 bg-white">
                            <CardHeader className="px-4 py-3">
                              <CardTitle className="text-sm font-medium flex items-center justify-between">
                                <span className="flex items-center gap-2 text-gray-700">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  New data
                                </span>
                                <button
                                  onClick={() => copyJson("New data", entry.newData)}
                                  className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                                >
                                  <Copy className="h-3 w-3" /> Copy
                                </button>
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 py-3 bg-gray-50 rounded-b-lg">
                              <pre className="text-xs text-gray-700 whitespace-pre-wrap break-all">
                                {JSON.stringify(entry.newData, null, 2)}
                              </pre>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

