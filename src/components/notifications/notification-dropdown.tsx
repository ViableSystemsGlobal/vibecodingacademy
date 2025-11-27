'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/contexts/toast-context';
import { useTheme } from '@/contexts/theme-context';
import Link from 'next/link';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  readAt: string | null;
  createdAt: string;
  data: any;
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { getThemeColor } = useTheme();
  const { success } = useToast();

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications?limit=10&status=SENT');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        const unread = (data.notifications || []).filter((n: Notification) => !n.readAt).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch notifications on mount and when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/mark-read`, {
        method: 'PUT'
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n =>
            n.id === notificationId ? { ...n, readAt: new Date().toISOString() } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PUT'
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
        success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getNotificationLink = (notification: Notification): string | null => {
    const data = notification.data || {};
    
    // Map notification types to routes
    const routeMap: { [key: string]: (data: any) => string | null } = {
      'task_created': () => data.taskId ? `/projects/${data.projectId}/tasks/${data.taskId}` : null,
      'task_assigned': () => data.taskId ? `/projects/${data.projectId}/tasks/${data.taskId}` : null,
      'task_due_soon': () => data.taskId ? `/projects/${data.projectId}/tasks/${data.taskId}` : null,
      'task_overdue': () => data.taskId ? `/projects/${data.projectId}/tasks/${data.taskId}` : null,
      'project_created': () => data.projectId ? `/projects/${data.projectId}` : null,
      'project_updated': () => data.projectId ? `/projects/${data.projectId}` : null,
      'invoice_created': () => data.invoiceId ? `/invoices/${data.invoiceId}` : null,
      'invoice_overdue': () => data.invoiceId ? `/invoices/${data.invoiceId}` : null,
      'quotation_created': () => data.quotationId ? `/quotations/${data.quotationId}` : null,
      'order_created': () => data.orderId ? `/orders/${data.orderId}` : null,
      'lead_created': () => data.leadId ? `/crm/leads/${data.leadId}` : null,
      'lead_assigned': () => data.leadId ? `/crm/leads/${data.leadId}` : null,
      'stock_low': () => '/inventory/stock',
      'stock_out': () => '/inventory/stock',
      'payment_received': () => data.invoiceId ? `/invoices/${data.invoiceId}` : '/payments',
    };

    const getRoute = routeMap[notification.type] || (() => null);
    return getRoute(data);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-9 w-9 text-gray-500 hover:text-gray-900"
        style={{ 
          color: isOpen ? getThemeColor() : undefined,
          backgroundColor: isOpen ? `${getThemeColor()}15` : undefined
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: getThemeColor() }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
          <div className="flex items-center justify-between border-b border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-7"
                >
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => {
                  const isRead = !!notification.readAt;
                  const link = getNotificationLink(notification);
                  const NotificationContent = (
                    <div
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !isRead ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={`text-sm font-medium ${
                                !isRead ? 'text-gray-900' : 'text-gray-700'
                              }`}
                            >
                              {notification.title}
                            </p>
                            {!isRead && (
                              <span
                                className="h-2 w-2 rounded-full flex-shrink-0 mt-1"
                                style={{ backgroundColor: getThemeColor() }}
                              />
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {new Date(notification.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {!isRead && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="h-6 w-6 flex-shrink-0"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );

                  return link ? (
                    <Link key={notification.id} href={link} onClick={() => markAsRead(notification.id)}>
                      {NotificationContent}
                    </Link>
                  ) : (
                    <div key={notification.id} onClick={() => markAsRead(notification.id)}>
                      {NotificationContent}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="border-t border-gray-200 p-3 text-center">
              <Link
                href="/notifications"
                className="text-sm font-medium"
                style={{ color: getThemeColor() }}
                onClick={() => setIsOpen(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

