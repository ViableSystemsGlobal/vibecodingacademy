import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { ResourceRequestComments } from "@/components/resource-request-comments";
import {
  Calendar,
  User,
  Mail,
  Package,
  DollarSign,
  Edit,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ViewProjectResourceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEdit?: () => void;
  projectId: string;
  resourceRequest: {
    id: string;
    title: string;
    details: string | null;
    status: string;
    priority: string;
    quantity: number;
    unit: string;
    sku: string | null;
    neededBy: string | null;
    assignedTeam: string;
    estimatedCost: number | null;
    currency: string | null;
    emailTo: string | null;
    emailCc: string | null;
    requester?: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    } | null;
    items?: Array<{
      id?: string;
      productName: string;
      quantity: number;
      unit: string;
    }>;
    stage?: {
      id: string;
      name: string;
      color: string;
    } | null;
  } | null;
}

export function ViewProjectResourceRequestModal({
  isOpen,
  onClose,
  onEdit,
  projectId,
  resourceRequest,
}: ViewProjectResourceRequestModalProps) {
  const { getThemeColor } = useTheme();
  const [fullRequest, setFullRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && resourceRequest?.id) {
      fetchFullRequest();
    }
  }, [isOpen, resourceRequest?.id, projectId]);

  const fetchFullRequest = async () => {
    if (!resourceRequest?.id) return;
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/resource-requests/${resourceRequest.id}`);
      if (response.ok) {
        const data = await response.json();
        setFullRequest(data.resourceRequest || data);
      }
    } catch (error) {
      console.error("Error fetching resource request:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!resourceRequest) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "FULFILLED":
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case "SUBMITTED":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "DECLINED":
      case "CANCELLED":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "bg-red-100 text-red-800 border-red-200";
      case "HIGH":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "NORMAL":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "LOW":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800 border-green-200";
      case "FULFILLED":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "SUBMITTED":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "DECLINED":
      case "CANCELLED":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const requestData = fullRequest || resourceRequest;
  const items = requestData?.items || [];

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold text-gray-900 mb-2">
                {resourceRequest.title}
              </DialogTitle>
              <div className="flex items-center gap-3 flex-wrap mt-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(resourceRequest.status)}
                  <Badge variant="outline" className={getStatusColor(resourceRequest.status)}>
                    {resourceRequest.status.replace("_", " ")}
                  </Badge>
                </div>
                <Badge variant="outline" className={getPriorityColor(resourceRequest.priority)}>
                  {resourceRequest.priority}
                </Badge>
                {resourceRequest.stage && (
                  <Badge
                    variant="outline"
                    style={{
                      backgroundColor: `${resourceRequest.stage.color}20`,
                      borderColor: resourceRequest.stage.color,
                      color: resourceRequest.stage.color,
                    }}
                  >
                    {resourceRequest.stage.name}
                  </Badge>
                )}
              </div>
            </div>
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Description */}
          {resourceRequest.details && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{resourceRequest.details}</p>
            </div>
          )}

          {/* Items/Products */}
          {items.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Requested Items
              </h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Product Name</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-700">Quantity</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item: any, index: number) => (
                      <tr key={index} className="bg-white">
                        <td className="px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">{item.quantity}</td>
                        <td className="px-4 py-2 text-sm text-gray-500">{item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Needed By</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                {resourceRequest.neededBy ? (
                  <span>{formatDate(resourceRequest.neededBy)}</span>
                ) : (
                  <span className="text-gray-400">No date specified</span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Assigned Team</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{resourceRequest.assignedTeam}</span>
              </div>
            </div>

            {resourceRequest.estimatedCost && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Estimated Cost</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <DollarSign className="w-4 h-4" />
                  <span>
                    {formatCurrency(
                      resourceRequest.estimatedCost,
                      resourceRequest.currency || "USD"
                    )}
                  </span>
                </div>
              </div>
            )}

            {resourceRequest.requester && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Requested By</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>{resourceRequest.requester.name || resourceRequest.requester.email}</span>
                </div>
              </div>
            )}

            {resourceRequest.emailTo && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Email To</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="break-all">{resourceRequest.emailTo}</span>
                </div>
              </div>
            )}

            {resourceRequest.emailCc && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Email CC</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  <span className="break-all">{resourceRequest.emailCc}</span>
                </div>
              </div>
            )}
          </div>

          {/* Comments Section */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Comments</h3>
            <div className="border border-gray-200 rounded-lg p-4">
              <ResourceRequestComments
                projectId={projectId}
                requestId={resourceRequest.id}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-2">
          {onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
              className="flex items-center gap-2"
            >
              <Edit className="w-4 h-4" />
              Edit Request
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

