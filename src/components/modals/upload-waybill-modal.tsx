'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from '@/contexts/toast-context';
import { useTheme } from '@/contexts/theme-context';

interface UploadWaybillModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  orderId: string;
  onSuccess: () => void;
  onMarkDelivered?: () => void;
}

export function UploadWaybillModal({ isOpen, onClose, orderNumber, orderId, onSuccess, onMarkDelivered }: UploadWaybillModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [waybillImage, setWaybillImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [markAsDelivered, setMarkAsDelivered] = useState(false);

  const { success, error } = useToast();
  const { getThemeClasses, getThemeColor } = useTheme();
  const theme = getThemeClasses();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        error('Image size must be less than 5MB');
        return;
      }
      if (!file.type.startsWith('image/')) {
        error('Please upload an image file');
        return;
      }
      setWaybillImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setWaybillImage(null);
    setImagePreview(null);
  };

  const handleUpload = async () => {
    if (!waybillImage) {
      error('Please select a waybill image to upload');
      return;
    }

    setIsUploading(true);

    try {
      // Upload image
      const formDataToUpload = new FormData();
      formDataToUpload.append('file', waybillImage);
      formDataToUpload.append('folder', 'waybills');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formDataToUpload,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload waybill image');
      }

      const uploadData = await uploadResponse.json();
      const imageUrl = uploadData.url;

      // Update order with waybill image
      const updateData: any = {
        waybillImage: imageUrl,
      };

      // If user wants to mark as delivered, include status change
      if (markAsDelivered) {
        updateData.status = 'DELIVERED';
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save waybill image');
      }

      if (markAsDelivered) {
        success('Waybill uploaded successfully. Order status updated to DELIVERED.');
        if (onMarkDelivered) {
          onMarkDelivered();
        }
      } else {
        success('Waybill uploaded successfully');
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error uploading waybill:', err);
      error(err instanceof Error ? err.message : 'Failed to upload waybill');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Waybill</DialogTitle>
          <DialogDescription>
            Upload a scanned copy of the waybill for order {orderNumber}. Once uploaded, you can mark the order as delivered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Waybill Image Upload */}
          <div>
            <Label htmlFor="waybillImage">Waybill Image</Label>
            <div className="mt-2">
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Waybill preview"
                    className="max-w-full h-auto max-h-64 rounded-lg border"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <label
                    htmlFor="waybillImage"
                    className="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
                  >
                    Click to upload waybill image
                  </label>
                  <input
                    id="waybillImage"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Upload a scanned copy of the waybill. This allows you to mark the order as delivered.
            </p>
          </div>

          {/* Mark as Delivered Option */}
          {waybillImage && (
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="markDelivered"
                checked={markAsDelivered}
                onChange={(e) => setMarkAsDelivered(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="markDelivered" className="text-sm text-gray-700 cursor-pointer">
                Mark order as DELIVERED after uploading
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={isUploading || !waybillImage}
            style={{ backgroundColor: getThemeColor() }}
            className="text-white"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Waybill
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

