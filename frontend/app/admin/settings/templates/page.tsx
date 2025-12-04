'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Mail, MessageSquare, Plus, Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface EmailTemplate {
  id: string;
  key: string;
  subject: string;
  htmlBody: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SmsTemplate {
  id: string;
  key: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const queryClient = useQueryClient();
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [editingEmailTemplate, setEditingEmailTemplate] = useState<EmailTemplate | null>(null);
  const [editingSmsTemplate, setEditingSmsTemplate] = useState<SmsTemplate | null>(null);

  const { data: emailTemplates, isLoading: emailLoading } = useQuery<EmailTemplate[]>({
    queryKey: ['admin-email-templates'],
    queryFn: () => apiClient.get<EmailTemplate[]>('/admin/templates/email'),
  });

  const { data: smsTemplates, isLoading: smsLoading } = useQuery<SmsTemplate[]>({
    queryKey: ['admin-sms-templates'],
    queryFn: () => apiClient.get<SmsTemplate[]>('/admin/templates/sms'),
  });


  const handleEditEmail = (template: EmailTemplate) => {
    setEditingEmailTemplate(template);
    setIsEmailDialogOpen(true);
  };

  const handleEditSms = (template: SmsTemplate) => {
    setEditingSmsTemplate(template);
    setIsSmsDialogOpen(true);
  };

  const handleCreateEmail = () => {
    setEditingEmailTemplate(null);
    setIsEmailDialogOpen(true);
  };

  const handleCreateSms = () => {
    setEditingSmsTemplate(null);
    setIsSmsDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email & SMS Templates</h1>
        <p className="text-muted-foreground">
          Manage email and SMS templates used for notifications
        </p>
      </div>

      <Tabs defaultValue="email" className="space-y-6">
        <TabsList>
          <TabsTrigger value="email">
            <Mail className="w-4 h-4 mr-2" />
            Email Templates
          </TabsTrigger>
          <TabsTrigger value="sms">
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS Templates
          </TabsTrigger>
        </TabsList>

        {/* Email Templates Tab */}
        <TabsContent value="email" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Email Templates</CardTitle>
                  <CardDescription>
                    Manage email templates for notifications and communications
                  </CardDescription>
                </div>
                <Button onClick={handleCreateEmail}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {emailLoading ? (
                <div>Loading email templates...</div>
              ) : emailTemplates && emailTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No email templates found. Create your first template to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emailTemplates?.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {template.key}
                          </code>
                        </TableCell>
                        <TableCell>{template.subject}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              template.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {template.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(template.updatedAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditEmail(template)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SMS Templates Tab */}
        <TabsContent value="sms" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SMS Templates</CardTitle>
                  <CardDescription>
                    Manage SMS templates for notifications and reminders
                  </CardDescription>
                </div>
                <Button onClick={handleCreateSms}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {smsLoading ? (
                <div>Loading SMS templates...</div>
              ) : smsTemplates && smsTemplates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No SMS templates found. Create your first template to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Content Preview</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {smsTemplates?.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">
                          <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                            {template.key}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-md truncate">
                            {template.content.substring(0, 60)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-semibold ${
                              template.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {template.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(template.updatedAt), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditSms(template)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Template Dialog */}
      <EmailTemplateDialog
        template={editingEmailTemplate}
        open={isEmailDialogOpen}
        onClose={() => {
          setIsEmailDialogOpen(false);
          setEditingEmailTemplate(null);
        }}
      />

      {/* SMS Template Dialog */}
      <SmsTemplateDialog
        template={editingSmsTemplate}
        open={isSmsDialogOpen}
        onClose={() => {
          setIsSmsDialogOpen(false);
          setEditingSmsTemplate(null);
        }}
      />
    </div>
  );
}

function EmailTemplateDialog({
  template,
  open,
  onClose,
}: {
  template: EmailTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    key: template?.key || '',
    subject: template?.subject || '',
    htmlBody: template?.htmlBody || '',
    isActive: template?.isActive !== false,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.post('/admin/templates/email', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] });
      toast.success('Email template created successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create email template');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.put(`/admin/templates/email/${template?.key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] });
      toast.success('Email template updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update email template');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (template) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit Email Template' : 'Create Email Template'}</DialogTitle>
          <DialogDescription>
            {template
              ? 'Update the email template content'
              : 'Create a new email template for notifications'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email-key">Template Key *</Label>
            <Input
              id="email-key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="registration_confirmation"
              disabled={!!template}
              required
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier (e.g., registration_confirmation, payment_receipt)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-subject">Subject *</Label>
            <Input
              id="email-subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Registration Confirmed - {{class_title}}"
              required
            />
            <p className="text-xs text-muted-foreground">
              Available variables: {'{{parent_name}}'}, {'{{student_name}}'}, {'{{class_title}}'}, {'{{start_time}}'}, {'{{meeting_link}}'}, {'{{amount}}'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-body">HTML Body *</Label>
            <Textarea
              id="email-body"
              value={formData.htmlBody}
              onChange={(e) => setFormData({ ...formData, htmlBody: e.target.value })}
              rows={15}
              className="font-mono text-sm"
              placeholder="<h2>Welcome!</h2><p>Hello {{parent_name}},...</p>"
              required
            />
            <p className="text-xs text-muted-foreground">
              HTML content with variable placeholders. Available variables: {'{{parent_name}}'}, {'{{student_name}}'}, {'{{class_title}}'}, {'{{start_time}}'}, {'{{meeting_link}}'}, {'{{amount}}'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Only active templates will be used
              </p>
            </div>
            <Switch
              id="email-active"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          {(createMutation.isError || updateMutation.isError) && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {(createMutation.error || updateMutation.error) instanceof Error
                ? (createMutation.error || updateMutation.error)?.message
                : 'Failed to save template'}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : template
                ? 'Update Template'
                : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SmsTemplateDialog({
  template,
  open,
  onClose,
}: {
  template: SmsTemplate | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    key: template?.key || '',
    content: template?.content || '',
    isActive: template?.isActive !== false,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => apiClient.post('/admin/templates/sms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sms-templates'] });
      toast.success('SMS template created successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create SMS template');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiClient.put(`/admin/templates/sms/${template?.key}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sms-templates'] });
      toast.success('SMS template updated successfully');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update SMS template');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (template) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit SMS Template' : 'Create SMS Template'}</DialogTitle>
          <DialogDescription>
            {template
              ? 'Update the SMS template content'
              : 'Create a new SMS template for notifications'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sms-key">Template Key *</Label>
            <Input
              id="sms-key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              placeholder="class_reminder"
              disabled={!!template}
              required
            />
            <p className="text-xs text-muted-foreground">
              Unique identifier (e.g., class_reminder, payment_confirmation)
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-content">Content *</Label>
              <span
                className={`text-xs ${
                  formData.content.length > 160
                    ? 'text-red-600 font-semibold'
                    : formData.content.length > 140
                    ? 'text-orange-600'
                    : 'text-muted-foreground'
                }`}
              >
                {formData.content.length} / 160 characters
                {formData.content.length > 160 && ' (exceeds SMS limit)'}
              </span>
            </div>
            <Textarea
              id="sms-content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              placeholder="Hello {{parent_name}}, reminder: {{student_name}} has class {{class_title}} on {{start_time}}. Join: {{meeting_link}}"
              required
            />
            <p className="text-xs text-muted-foreground">
              SMS content (max 160 characters recommended). Available variables: {'{{parent_name}}'}, {'{{student_name}}'}, {'{{class_title}}'}, {'{{start_time}}'}, {'{{meeting_link}}'}, {'{{amount}}'}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="sms-active">Active</Label>
              <p className="text-sm text-muted-foreground">
                Only active templates will be used
              </p>
            </div>
            <Switch
              id="sms-active"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          {(createMutation.isError || updateMutation.isError) && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {(createMutation.error || updateMutation.error) instanceof Error
                ? (createMutation.error || updateMutation.error)?.message
                : 'Failed to save template'}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : template
                ? 'Update Template'
                : 'Create Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

