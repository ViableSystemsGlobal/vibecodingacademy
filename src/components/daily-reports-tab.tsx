"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Calendar,
  Image as ImageIcon,
  X,
  Edit,
  Trash2,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import Image from "next/image";

type DailyReportImage = {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  createdAt: string;
};

type DailyReport = {
  id: string;
  title: string;
  content: string;
  reportDate: string;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  images: DailyReportImage[];
};

interface DailyReportsTabProps {
  projectId: string;
}

export function DailyReportsTab({ projectId }: DailyReportsTabProps) {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(null);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [displayLimit, setDisplayLimit] = useState(10);
  const [hasMore, setHasMore] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [reportDate, setReportDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);

  useEffect(() => {
    loadReports();
  }, [projectId]);

  useEffect(() => {
    setHasMore(reports.length > displayLimit);
  }, [reports.length, displayLimit]);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/daily-reports`);
      
      if (!response.ok) {
        let errorData: any = null;
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
          }
        } else {
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
          console.error(`[DAILY-REPORTS] Failed: ${errorMessage} (${statusText})`);
          throw new Error(errorMessage);
        } else {
          console.error(`[DAILY-REPORTS] Failed: ${statusText}`);
          throw new Error(`Failed to load daily reports (${statusText})`);
        }
      }
      
      const data = await response.json();
      const reportsData = data || [];
      setReports(reportsData);
      
      // Set initial expanded state: expand first 2-3 reports (most recent)
      const initialExpanded = new Set<string>();
      const reportsToExpand = Math.min(3, reportsData.length);
      for (let i = 0; i < reportsToExpand; i++) {
        initialExpanded.add(reportsData[i].id);
      }
      setExpandedReports(initialExpanded);
      
      // Check if there are more reports to load
      setHasMore(reportsData.length > 10);
    } catch (error: any) {
      console.error("[DAILY-REPORTS] Error loading daily reports:", error);
      console.error("[DAILY-REPORTS] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      showError("Error", error.message || "Failed to load daily reports");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      showError("Error", "Please select image files only");
      return;
    }

    // Check file sizes (10MB limit)
    const oversizedFiles = imageFiles.filter((file) => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      showError("Error", "Some files exceed 10MB limit");
      return;
    }

    setImages((prev) => [...prev, ...imageFiles]);

    // Create previews
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreviews((prev) => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (reportId: string): Promise<void> => {
    const uploadPromises = images.map(async (image, index) => {
      try {
        setUploadingImages((prev) => [...prev, image.name]);
        const formData = new FormData();
        formData.append("file", image);

        const response = await fetch(
          `/api/projects/${projectId}/daily-reports/${reportId}/images`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to upload ${image.name}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Error uploading ${image.name}:`, error);
        throw error;
      } finally {
        setUploadingImages((prev) => prev.filter((name) => name !== image.name));
      }
    });

    await Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      showError("Error", "Title and content are required");
      return;
    }

    try {
      setIsCreating(true);

      // Create or update report
      const url = selectedReport
        ? `/api/projects/${projectId}/daily-reports/${selectedReport.id}`
        : `/api/projects/${projectId}/daily-reports`;
      const method = selectedReport ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          reportDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to save daily report");
      }

      const report = await response.json();

      // Upload images if any
      if (images.length > 0) {
        await uploadImages(report.id);
      }

      success("Daily report saved successfully");
      resetForm();
      loadReports();
    } catch (error: any) {
      showError("Error", error.message || "Failed to save daily report");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (report: DailyReport) => {
    setSelectedReport(report);
    setTitle(report.title);
    setContent(report.content);
    setReportDate(new Date(report.reportDate).toISOString().split("T")[0]);
    setImages([]);
    setImagePreviews([]);
    setIsEditModalOpen(true);
  };

  const toggleReport = (reportId: string) => {
    setExpandedReports((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(reportId)) {
        newSet.delete(reportId);
      } else {
        newSet.add(reportId);
      }
      return newSet;
    });
  };

  const loadMoreReports = () => {
    setDisplayLimit((prev) => prev + 10);
  };

  const handleDelete = async (reportId: string) => {
    if (!confirm("Are you sure you want to delete this daily report?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/projects/${projectId}/daily-reports/${reportId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete daily report");
      }

      success("Daily report deleted successfully");
      loadReports();
    } catch (error: any) {
      showError("Error", error.message || "Failed to delete daily report");
    }
  };

  const handleDeleteImage = async (reportId: string, imageId: string) => {
    try {
      const response = await fetch(
        `/api/projects/${projectId}/daily-reports/${reportId}/images?imageId=${imageId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete image");
      }

      success("Image deleted successfully");
      loadReports();
    } catch (error: any) {
      showError("Error", error.message || "Failed to delete image");
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setReportDate(new Date().toISOString().split("T")[0]);
    setImages([]);
    setImagePreviews([]);
    setSelectedReport(null);
    setIsEditModalOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading daily reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create/Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {selectedReport ? "Edit Daily Report" : "Create Daily Report"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Day 1 Progress Update"
                  required
                />
              </div>
              <div>
                <Label htmlFor="reportDate">Report Date *</Label>
                <Input
                  id="reportDate"
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your daily report here..."
                rows={8}
                required
              />
            </div>

            <div>
              <Label htmlFor="images">Add Images (Optional)</Label>
              <div className="mt-2">
                <Input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="cursor-pointer"
                />
                <p className="text-xs text-gray-500 mt-1">
                  You can select multiple images. Max 10MB per image.
                </p>
              </div>

              {/* Image Previews */}
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <Image
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          width={200}
                          height={200}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      {uploadingImages.includes(images[index]?.name || "") && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                          <div className="text-white text-xs">Uploading...</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={isCreating}
                className="inline-flex items-center gap-2 text-white"
                style={{ backgroundColor: getThemeColor(), borderColor: getThemeColor() }}
              >
                {isCreating ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    {selectedReport ? "Update Report" : "Create Report"}
                  </>
                )}
              </Button>
              {selectedReport && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Reports List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Previous Reports ({reports.length})
        </h3>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No daily reports yet.</p>
              <p className="text-sm text-gray-400 mt-1">
                Create your first daily report above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reports.slice(0, displayLimit).map((report) => {
              const isExpanded = expandedReports.has(report.id);
              const contentPreview = report.content.length > 150 
                ? report.content.substring(0, 150) + "..." 
                : report.content;
              
              return (
                <Card key={report.id} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleReport(report.id)}
                            className="flex-shrink-0 p-1 hover:bg-gray-100 rounded transition-colors"
                            aria-label={isExpanded ? "Collapse report" : "Expand report"}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-gray-500" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-500" />
                            )}
                          </button>
                          <CardTitle className="text-lg flex-1">{report.title}</CardTitle>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 ml-7">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(report.reportDate)}
                          </div>
                          <div>
                            By {report.author.name || report.author.email}
                          </div>
                          {report.images.length > 0 && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <ImageIcon className="h-4 w-4" />
                              {report.images.length} image{report.images.length !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(report)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(report.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="prose max-w-none">
                        <p className="whitespace-pre-wrap text-gray-700">
                          {report.content}
                        </p>
                      </div>

                      {/* Report Images */}
                      {report.images.length > 0 && (
                        <div className="mt-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            Images ({report.images.length})
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {report.images.map((image) => (
                              <div key={image.id} className="relative group">
                                <div className="aspect-square rounded-lg overflow-hidden border border-gray-200">
                                  <img
                                    src={`/api/projects/${projectId}/daily-reports/${report.id}/images/${image.id}`}
                                    alt={image.originalName}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      console.error("Failed to load image:", image.filePath);
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleDeleteImage(report.id, image.id)}
                                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                  
                  {!isExpanded && (
                    <CardContent className="pt-0">
                      <p className="text-gray-600 text-sm line-clamp-2">
                        {contentPreview}
                      </p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
            
            {hasMore && reports.length > displayLimit && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMoreReports}
                  className="text-white"
                  style={{ backgroundColor: getThemeColor(), borderColor: getThemeColor() }}
                >
                  Load More Reports
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

