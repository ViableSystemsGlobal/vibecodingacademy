'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Mail, Phone, Building, Calendar, User, Clock, CheckCircle, AlertCircle, XCircle, Play, Link, Tag, TrendingUp, Users, MessageSquare, FileText, Video, PhoneCall, Star, Target, Plus, Activity, History, DollarSign, UserPlus, FileCheck, FileBarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { EditLeadModal } from '@/components/modals/edit-lead-modal';
import { ConfirmDeleteModal } from '@/components/modals/confirm-delete-modal';
import { AIRecommendationCard } from '@/components/ai-recommendation-card';
import { AddLeadTaskModal } from '@/components/modals/add-lead-task-modal';
import { AddLeadCommentModal } from '@/components/modals/add-lead-comment-modal';
import { AddLeadFileModal } from '@/components/modals/add-lead-file-modal';
import { AddLeadEmailModal } from '@/components/modals/add-lead-email-modal';
import { AddLeadSMSModal } from '@/components/modals/add-lead-sms-modal';
import AddLeadProductModal from '@/components/modals/add-lead-product-modal';
import AddLeadUserModal from '@/components/modals/add-lead-user-modal';
import AddLeadMeetingModal from '@/components/modals/add-lead-meeting-modal';
import TaskSlideout from '@/components/task-slideout';
import LeadToQuoteConfirmationModal from '@/components/modals/lead-to-quote-confirmation-modal';

interface User {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  sku?: string;
  description?: string;
}

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  leadType: 'INDIVIDUAL' | 'COMPANY';
  company?: string;
  subject?: string;
  source?: string;
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'LOST';
  assignedTo?: User[];
  interestedProducts?: Product[];
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    name: string;
    email: string;
  };
}

// Helper function to normalize status for display and filtering
const normalizeLeadStatus = (status: string): string => {
  // Map legacy QUOTE_SENT to CONVERTED_TO_OPPORTUNITY
  if (status === 'QUOTE_SENT') {
    return 'CONVERTED_TO_OPPORTUNITY';
  }
  // Map legacy CONVERTED to CONVERTED_TO_OPPORTUNITY
  if (status === 'CONVERTED' || status === 'OPPORTUNITY' || status === 'NEW_OPPORTUNITY') {
    return 'CONVERTED_TO_OPPORTUNITY';
  }
  return status;
};

// Helper function to get display label for status
const getStatusLabel = (status: string): string => {
  const normalized = normalizeLeadStatus(status);
  if (normalized === 'CONVERTED_TO_OPPORTUNITY') {
    return 'Converted';
  }
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

// Status colors matching the leads page
const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-yellow-100 text-yellow-800',
  QUALIFIED: 'bg-green-100 text-green-800',
  QUOTE_SENT: 'bg-purple-100 text-purple-800', // Quote sent = converted
  CONVERTED_TO_OPPORTUNITY: 'bg-purple-100 text-purple-800', // Main status when quote is sent
  CONVERTED: 'bg-purple-100 text-purple-800', // Legacy status
  LOST: 'bg-red-100 text-red-800',
  UNQUALIFIED: 'bg-gray-100 text-gray-800',
};

export default function LeadDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();
  const { success, error } = useToast();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskInitialData, setTaskInitialData] = useState<{
    title?: string;
    description?: string;
    dueDate?: string;
  } | null>(null);
  const [showAddCommentModal, setShowAddCommentModal] = useState(false);
  const [showAddFileModal, setShowAddFileModal] = useState(false);
  const [showAddEmailModal, setShowAddEmailModal] = useState(false);
  const [showAddSMSModal, setShowAddSMSModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddMeetingModal, setShowAddMeetingModal] = useState(false);
  const [showQuoteConfirmationModal, setShowQuoteConfirmationModal] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [smsHistory, setSmsHistory] = useState<any[]>([]);
  const [emailHistory, setEmailHistory] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [files, setFiles] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<any[]>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [metrics, setMetrics] = useState({
    totalInteractions: 0,
    conversionProbability: 0,
    lastActivity: 'Never'
  });
  const [aiRecommendations, setAiRecommendations] = useState([
    {
      id: '1',
      title: 'Follow up on recent inquiry',
      description: 'This lead showed interest in pool products 2 days ago. Consider sending a personalized follow-up email.',
      priority: 'high' as const,
      action: 'Send follow-up email',
      completed: false
    },
    {
      id: '2',
      title: 'Schedule product demonstration',
      description: 'Based on their company size and interest, a product demo could accelerate the sales process.',
      priority: 'medium' as const,
      action: 'Schedule demo call',
      completed: false
    }
  ]);

  const [activities, setActivities] = useState([
    {
      id: 1,
      type: 'lead_created',
      title: 'Lead Created',
      description: 'Lead was created and assigned to the system',
      timestamp: new Date().toISOString(),
      user: 'System',
      icon: UserPlus,
      color: 'bg-blue-500'
    },
    {
      id: 2,
      type: 'email_sent',
      title: 'Welcome Email Sent',
      description: 'Initial welcome email sent to the lead',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      user: 'System Administrator',
      icon: Mail,
      color: 'bg-green-500'
    },
    {
      id: 3,
      type: 'status_changed',
      title: 'Status Updated',
      description: 'Lead status changed from NEW to CONTACTED',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      user: 'System Administrator',
      icon: CheckCircle,
      color: 'bg-yellow-500'
    },
    {
      id: 4,
      type: 'call_scheduled',
      title: 'Call Scheduled',
      description: 'Follow-up call scheduled for tomorrow at 2:00 PM',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      user: 'System Administrator',
      icon: PhoneCall,
      color: 'bg-purple-500'
    }
  ]);

  const [sources, setSources] = useState<any[]>([]);

  const leadId = params.id as string;

  // Helper function to format timestamps
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchLead();
      fetchSources();
    }
  }, [leadId]);

  useEffect(() => {
    if (lead?.id) {
      fetchTasks();
      fetchSmsHistory();
      fetchEmailHistory();
      fetchComments();
      fetchFiles();
      fetchMeetings();
      fetchProducts();
      fetchAssignedUsers();
    }
  }, [lead?.id]);

  // Update metrics and activities when data changes
  useEffect(() => {
    updateMetrics();
    updateActivities();
  }, [comments, emailHistory, smsHistory, tasks, files, meetings, products, lead]);


  const fetchSources = async () => {
    try {
      const response = await fetch('/api/lead-sources');
      if (response.ok) {
        const data = await response.json();
        // Ensure data is an array
        setSources(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching sources:', error);
      setSources([]); // Set empty array on error
    }
  };

  const fetchTasks = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/tasks?leadId=${lead.id}`);
      if (response.ok) {
        const data = await response.json();
        // The API returns { tasks: [], pagination: {} }
        setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]); // Set empty array on error
    }
  };

  const fetchSmsHistory = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/lead-sms?leadId=${lead.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setSmsHistory(Array.isArray(data.sms) ? data.sms : []);
      }
    } catch (error) {
      console.error('Error fetching SMS history:', error);
      setSmsHistory([]);
    }
  };

  const fetchEmailHistory = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/lead-emails?leadId=${lead.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setEmailHistory(Array.isArray(data.emails) ? data.emails : []);
      }
    } catch (error) {
      console.error('Error fetching email history:', error);
      setEmailHistory([]);
    }
  };

  const fetchComments = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/lead-comments?leadId=${lead.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setComments(Array.isArray(data.comments) ? data.comments : []);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    }
  };

  const fetchFiles = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/lead-files?leadId=${lead.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setFiles(Array.isArray(data.files) ? data.files : []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
    }
  };

  const fetchMeetings = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/lead-meetings?leadId=${lead.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setMeetings(Array.isArray(data.meetings) ? data.meetings : []);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setMeetings([]);
    }
  };

  const fetchProducts = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/leads/${lead.id}/products`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Products API response:', data);
        
        // Get products from LeadProduct model (added via + button)
        const leadProducts = Array.isArray(data.products) ? data.products : [];
        
        // Get products from interestedProducts field (added during lead creation)
        const interestedProducts = lead?.interestedProducts ? 
          (typeof lead.interestedProducts === 'string' ? JSON.parse(lead.interestedProducts) : lead.interestedProducts) : [];
        
        // Combine both sources and format them consistently, avoiding duplicates
        const productMap = new Map();
        
        // First, add interestedProducts (from lead creation)
        interestedProducts.forEach((product: any, index: number) => {
          const productKey = product.id;
          if (!productMap.has(productKey)) {
            productMap.set(productKey, {
              id: `interested-${product.id}-${index}`,
              leadId: lead.id,
              productId: product.id,
              quantity: 1,
              notes: null,
              interestLevel: 'MEDIUM',
              addedBy: lead.owner.id,
              createdAt: lead.createdAt,
              updatedAt: lead.updatedAt,
              source: 'lead_creation', // Track the source
              product: {
                id: product.id,
                sku: product.sku,
                name: product.name,
                price: product.price,
                description: product.description,
              }
            });
          }
        });
        
        // Then, add leadProducts (from + button), but only if not already present
        leadProducts.forEach((leadProduct: any) => {
          const productKey = leadProduct.productId;
          if (!productMap.has(productKey)) {
            productMap.set(productKey, {
              ...leadProduct,
              source: 'manual_add' // Track the source
            });
          } else {
            // If product already exists, update with the more detailed information from + button
            const existing = productMap.get(productKey);
            productMap.set(productKey, {
              ...existing,
              ...leadProduct,
              source: 'both' // Track that it came from both sources
            });
          }
        });
        
        const combinedProducts = Array.from(productMap.values());
        
        setProducts(combinedProducts);
      } else {
        console.error('Products API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    }
  };

  const fetchAssignedUsers = async () => {
    if (!lead?.id) return;
    
    try {
      const response = await fetch(`/api/lead-users?leadId=${lead.id}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Assigned Users API response:', data);
        // Use assignedUsers from the new API response structure
        setAssignedUsers(Array.isArray(data.assignedUsers) ? data.assignedUsers : []);
      } else {
        console.error('Assigned Users API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching assigned users:', error);
      setAssignedUsers([]);
    }
  };

  const updateMetrics = () => {
    if (!lead) return;
    
    const totalInteractions = comments.length + emailHistory.length + smsHistory.length + tasks.length;
    
    // Response rate calculation removed - now using Stage Card instead
    
    // Calculate conversion probability based on status and interactions
    let conversionProbability = 15; // Base probability
    const normalizedStatus = normalizeLeadStatus(lead.status);
    if (normalizedStatus === 'CONVERTED_TO_OPPORTUNITY') conversionProbability = 100;
    else if (normalizedStatus === 'QUALIFIED') conversionProbability = 75;
    else if (normalizedStatus === 'CONTACTED') conversionProbability = 45;
    else if (normalizedStatus === 'NEW') conversionProbability = 15;
    
    // Add bonus for interactions
    if (totalInteractions > 5) conversionProbability += 10;
    else if (totalInteractions > 2) conversionProbability += 5;
    
    // Calculate real last activity from all activity types
    const allActivityDates = [
      ...emailHistory.map(e => e.sentAt || e.createdAt),
      ...smsHistory.map(s => s.sentAt || s.createdAt),
      ...tasks.map(t => t.updatedAt || t.createdAt),
      ...meetings.map(m => m.updatedAt || m.createdAt),
      ...comments.map(c => c.createdAt),
      ...files.map(f => f.createdAt),
      lead.createdAt
    ].filter(Boolean).map(date => new Date(date).getTime());
    
    const lastActivityTimestamp = allActivityDates.length > 0 ? Math.max(...allActivityDates) : new Date(lead.createdAt).getTime();
    const hoursSinceLastActivity = Math.floor((new Date().getTime() - lastActivityTimestamp) / (1000 * 60 * 60));
    
    let lastActivityText;
    if (hoursSinceLastActivity < 1) {
      lastActivityText = 'Just now';
    } else if (hoursSinceLastActivity < 24) {
      lastActivityText = `${hoursSinceLastActivity}h ago`;
    } else {
      const daysSince = Math.floor(hoursSinceLastActivity / 24);
      lastActivityText = daysSince === 1 ? 'Yesterday' : `${daysSince}d ago`;
    }
    
    setMetrics({
      totalInteractions,
      conversionProbability: Math.min(conversionProbability, 95),
      lastActivity: lastActivityText
    });
  };

  const updateActivities = () => {
    if (!lead) return;
    
    const newActivities = [];
    
    // Lead creation activity
    newActivities.push({
      id: 1,
      type: 'lead_created',
      title: 'Lead Created',
      description: `Lead "${lead.firstName} ${lead.lastName}" was created`,
      timestamp: lead.createdAt,
      user: 'System',
      icon: UserPlus,
      color: 'bg-blue-500'
    });
    
    // Comments activities
    comments.forEach((comment, index) => {
      newActivities.push({
        id: 1000 + index,
        type: 'comment_added',
        title: 'Comment Added',
        description: comment.isInternal ? 'Internal comment added' : 'Comment added',
        timestamp: comment.createdAt,
        user: comment.createdByUser?.name || 'Unknown User',
        icon: MessageSquare,
        color: comment.isInternal ? 'bg-yellow-500' : 'bg-gray-500'
      });
    });
    
    // Email activities
    emailHistory.forEach((email, index) => {
      newActivities.push({
        id: 2000 + index,
        type: 'email_sent',
        title: 'Email Sent',
        description: `Email sent: ${email.subject}`,
        timestamp: email.sentAt || email.createdAt,
        user: email.sentByUser?.name || 'Unknown User',
        icon: Mail,
        color: email.status === 'SENT' ? 'bg-green-500' : 'bg-red-500'
      });
    });
    
    // SMS activities
    smsHistory.forEach((sms, index) => {
      newActivities.push({
        id: 3000 + index,
        type: 'sms_sent',
        title: 'SMS Sent',
        description: `SMS sent to ${sms.to}`,
        timestamp: sms.sentAt || sms.createdAt,
        user: sms.sentByUser?.name || 'Unknown User',
        icon: MessageSquare,
        color: sms.status === 'SENT' ? 'bg-green-500' : 'bg-red-500'
      });
    });
    
    // Task activities
    tasks.forEach((task, index) => {
      newActivities.push({
        id: 4000 + index,
        type: 'task_created',
        title: 'Task Created',
        description: `Task created: ${task.title}`,
        timestamp: task.createdAt,
        user: task.assignedToUser?.name || 'Unknown User',
        icon: CheckCircle,
        color: task.status === 'COMPLETED' ? 'bg-green-500' : task.status === 'IN_PROGRESS' ? 'bg-yellow-500' : 'bg-blue-500'
      });
    });
    
    // File upload activities
    files.forEach((file, index) => {
      newActivities.push({
        id: 5000 + index,
        type: 'file_uploaded',
        title: 'File Uploaded',
        description: `File uploaded: ${file.fileName}`,
        timestamp: file.uploadedAt,
        user: file.uploadedByUser?.name || 'Unknown User',
        icon: FileText,
        color: 'bg-purple-500'
      });
    });
    
    // Meeting activities
    meetings.forEach((meeting, index) => {
      newActivities.push({
        id: 6000 + index,
        type: 'meeting_scheduled',
        title: 'Meeting Scheduled',
        description: `${meeting.type}: ${meeting.title}`,
        timestamp: meeting.createdAt,
        user: meeting.createdByUser?.name || 'Unknown User',
        icon: meeting.type === 'CALL' ? PhoneCall : Video,
        color: meeting.status === 'COMPLETED' ? 'bg-green-500' : meeting.status === 'CANCELLED' ? 'bg-red-500' : 'bg-blue-500'
      });
    });
    
    // Product activities
    products.forEach((product, index) => {
      newActivities.push({
        id: 7000 + index,
        type: 'product_added',
        title: 'Product Interest Added',
        description: `Added interest in ${product.product?.name || 'Unknown Product'} (${product.interestLevel} interest)`,
        timestamp: product.createdAt,
        user: product.addedByUser?.name || 'Unknown User',
        icon: Star,
        color: product.interestLevel === 'HIGH' ? 'bg-red-500' : product.interestLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
      });
    });
    
    // Sort by timestamp (newest first)
    newActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    setActivities(newActivities);
  };

  const fetchLead = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setLead(data.lead);
        
        // Calculate metrics based on lead data
        const leadData = data.lead;
        const daysSinceCreated = Math.floor((new Date().getTime() - new Date(leadData.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        
        // Calculate total interactions (will be updated when we fetch actual data)
        const totalInteractions = (comments.length + emailHistory.length + smsHistory.length + tasks.length);
        
        // Response rate calculation removed - now using Stage Card instead
        
        // Calculate conversion probability based on status and interactions
        let conversionProbability = 15; // Base probability
        const normalizedStatus = normalizeLeadStatus(leadData.status);
        if (normalizedStatus === 'CONVERTED_TO_OPPORTUNITY') conversionProbability = 100;
        else if (normalizedStatus === 'QUALIFIED') conversionProbability = 75;
        else if (normalizedStatus === 'CONTACTED') conversionProbability = 45;
        else if (normalizedStatus === 'NEW') conversionProbability = 15;
        
        // Add bonus for interactions
        if (totalInteractions > 5) conversionProbability += 10;
        else if (totalInteractions > 2) conversionProbability += 5;
        
        setMetrics({
          totalInteractions,
          conversionProbability: Math.min(conversionProbability, 95),
          lastActivity: daysSinceCreated === 0 ? 'Today' : daysSinceCreated === 1 ? 'Yesterday' : `${daysSinceCreated} days ago`
        });
      } else {
        error('Failed to fetch lead details');
        router.push('/crm/leads');
      }
    } catch (err) {
      console.error('Error fetching lead:', err);
      error('Failed to fetch lead details');
      router.push('/crm/leads');
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendationComplete = (recommendationId: string) => {
    setAiRecommendations(prev => 
      prev.map(rec => 
        rec.id === recommendationId ? { ...rec, completed: true } : rec
      )
    );
    success('Recommendation completed successfully!');
  };

  const handleAddTask = async (taskData: any) => {
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        success('Task created successfully!');
        // Refresh tasks list
        fetchTasks();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to create task');
      }
    } catch (err) {
      error('Failed to create task');
    }
  };

  const handleAddComment = async (commentData: any) => {
    try {
      const response = await fetch('/api/lead-comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(commentData),
      });

      if (response.ok) {
        success('Comment added successfully!');
        // Refresh comments list
        fetchComments();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to add comment');
      }
    } catch (err) {
      error('Failed to add comment');
    }
  };

  const handleAddFile = async (fileData: FormData) => {
    try {
      const response = await fetch('/api/lead-files', {
        method: 'POST',
        credentials: 'include',
        body: fileData,
      });

      if (response.ok) {
        success('File uploaded successfully!');
        // Refresh files list
        fetchFiles();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to upload file');
      }
    } catch (err) {
      error('Failed to upload file');
    }
  };

  const handleAddEmail = async (emailData: any) => {
    try {
      const response = await fetch('/api/lead-emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(emailData),
      });

      if (response.ok) {
        success('Email sent successfully!');
        fetchEmailHistory();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to send email');
      }
    } catch (err) {
      error('Failed to send email');
    }
  };

  const handleAddSMS = async (smsData: any) => {
    try {
      const response = await fetch('/api/lead-sms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(smsData),
      });

      if (response.ok) {
        success('SMS sent successfully!');
        fetchSmsHistory();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to send SMS');
      }
    } catch (err) {
      error('Failed to send SMS');
    }
  };

  const handleAddProduct = async (productData: any) => {
    try {
      // Check if product already exists
      const existingProduct = products.find(p => p.productId === productData.productId);
      if (existingProduct) {
        error('This product is already added to the lead. You can update the interest level or notes instead.');
        return;
      }

      const response = await fetch('/api/lead-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(productData),
      });

      if (response.ok) {
        success('Product interest added successfully!');
        fetchProducts();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to add product interest');
      }
    } catch (err) {
      error('Failed to add product interest');
    }
  };

  const handleAddUser = async (userData: any) => {
    try {
      const response = await fetch('/api/lead-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(userData),
      });

      if (response.ok) {
        success('User assigned successfully!');
        fetchAssignedUsers();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to assign user');
      }
    } catch (err) {
      error('Failed to assign user');
    }
  };

  const handleAddMeeting = async (meetingData: any) => {
    try {
      const response = await fetch('/api/lead-meetings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(meetingData),
      });

      if (response.ok) {
        success('Meeting scheduled successfully!');
        fetchMeetings();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to schedule meeting');
      }
    } catch (err) {
      error('Failed to schedule meeting');
    }
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
  };

  const handleEditLead = async (leadData: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    leadType: 'INDIVIDUAL' | 'COMPANY';
    company?: string;
    subject?: string;
    source?: string;
    status: string;
    assignedTo?: User[];
    interestedProducts?: Product[];
    followUpDate?: string;
    notes?: string;
  }) => {
    if (!lead) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
        credentials: 'include',
      });

      if (response.ok) {
        await fetchLead();
        setShowEditModal(false);
        success('Lead updated successfully!');
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to update lead');
      }
    } catch (err) {
      console.error('Error updating lead:', err);
      error('Failed to update lead');
    }
  };

  const handleDeleteLead = async () => {
    if (!lead) return;

    try {
      const response = await fetch(`/api/leads/${lead.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        success('Lead deleted successfully!');
        router.push('/crm/leads');
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to delete lead');
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
      error('Failed to delete lead');
    }
  };

  const handleCreateQuote = () => {
    if (!lead) return;
    setShowQuoteConfirmationModal(true);
  };

  const handleConfirmCreateQuote = () => {
    if (!lead) return;

    // Navigate to create quote page with lead details pre-filled
    // The lead will be converted to opportunity only after the quote is saved
    const queryParams = new URLSearchParams({
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadEmail: lead.email || '',
      leadPhone: lead.phone || '',
      leadCompany: lead.company || '',
    });

    console.log('Creating quote for lead:', `${lead.firstName} ${lead.lastName}`);
    console.log('🎯 Navigating to:', `/quotations/create?${queryParams.toString()}`);
    
    router.push(`/quotations/create?${queryParams.toString()}`);
  };

  const getStatusIcon = (status: string) => {
    const normalized = normalizeLeadStatus(status);
    switch (normalized) {
      case 'NEW':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'CONTACTED':
        return <Play className="w-5 h-5 text-yellow-500" />;
      case 'QUALIFIED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'CONVERTED_TO_OPPORTUNITY':
        return <CheckCircle className="w-5 h-5 text-purple-600" />;
      case 'LOST':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    const normalized = normalizeLeadStatus(status);
    return statusColors[normalized as keyof typeof statusColors] || statusColors.NEW;
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading lead details...</div>
        </div>
      </>
    );
  }

  if (!lead) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Lead not found</h2>
            <p className="text-gray-600 mb-4">The lead you're looking for doesn't exist or has been deleted.</p>
            <Button onClick={() => router.push('/crm/leads')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Leads
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/crm/leads')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Leads
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {lead.firstName} {lead.lastName}
                </h1>
                <p className="text-gray-600 mt-1">
                  {lead.subject || 'No Subject'}
                </p>
                
                {/* Contact Information */}
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-600 flex-wrap">
                  {lead.email && (
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      <span>{lead.email}</span>
                    </div>
                  )}
                  {lead.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>{lead.phone}</span>
                    </div>
                  )}
                  {lead.company && (
                    <div className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      <span>{lead.company}</span>
                    </div>
                  )}
                  {lead.followUpDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <span className={new Date(lead.followUpDate) < new Date() ? 'text-red-600 font-medium' : ''}>
                        Follow-up: {new Date(lead.followUpDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Pre-fill task form with follow-up date
                          if (lead.followUpDate) {
                            const followUpDateISO = new Date(lead.followUpDate).toISOString().slice(0, 16);
                            // We'll handle this in the AddLeadTaskModal by passing initialData
                            setTaskInitialData({
                              dueDate: followUpDateISO,
                              title: `Follow-up with ${lead.firstName} ${lead.lastName}`,
                              description: `Follow-up task for ${lead.company || 'lead'}`,
                            });
                            setShowAddTaskModal(true);
                          }
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Create Task
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => {
                  // TODO: Implement label functionality
                  console.log('Label clicked');
                }}
              >
                <Tag className="w-4 h-4" />
                Label
              </Button>
              <Button
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border-0"
                onClick={handleCreateQuote}
              >
                <FileBarChart className="w-4 h-4" />
                Create Quote
              </Button>
              <Button
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
                onClick={() => {
                  // TODO: Implement convert to opportunity functionality
                  console.log('Convert to opportunity clicked');
                }}
              >
                <TrendingUp className="w-4 h-4" />
                Convert to Opportunity
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </div>
          </div>
        </div>

        {/* AI Recommendation and Metrics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* AI Recommendation Card - Left Side */}
          <div className="lg:col-span-2">
            <AIRecommendationCard
              title="Lead Intelligence"
              subtitle="AI-powered insights for this lead"
              onRecommendationComplete={handleRecommendationComplete}
              page="leads"
              enableAI={true}
              context={{ leadId: params?.id }}
            />
          </div>

          {/* Metrics Cards - Right Side */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Interactions</p>
                  <p className="text-xl font-bold text-gray-900">{metrics.totalInteractions}</p>
                </div>
                <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                  <MessageSquare className={`w-5 h-5 text-${theme.primary}`} />
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Stage</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[normalizeLeadStatus(lead?.status || 'NEW') as keyof typeof statusColors] || statusColors.NEW
                    }`}>
                      {getStatusLabel(lead?.status || 'NEW')}
                    </span>
                  </div>
                </div>
                <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                  <Target className={`w-5 h-5 text-${theme.primary}`} />
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Conversion</p>
                  <p className="text-xl font-bold text-gray-900">{metrics.conversionProbability}%</p>
                </div>
                <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                  <TrendingUp className={`w-5 h-5 text-${theme.primary}`} />
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Last Activity</p>
                  <p className="text-xl font-bold text-gray-900">{metrics.lastActivity}</p>
                </div>
                <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                  <Clock className={`w-5 h-5 text-${theme.primary}`} />
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Detail Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Tasks */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Tasks</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTaskInitialData(null);
                  setShowAddTaskModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tasks && tasks.length > 0 ? (
              <div className="space-y-3">
                {tasks.slice(0, 3).map((task) => (
                  <div 
                    key={task.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => handleTaskClick(task)}
                  >
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                          task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          task.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
                          task.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                          task.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                    </div>
                    {task.dueDate && (
                      <div className="text-xs text-gray-500">
                        {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
                {tasks.length > 3 && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    +{tasks.length - 3} more tasks
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No tasks assigned</p>
              </div>
            )}
          </Card>

          {/* Products */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Products</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddProductModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {products.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {products.map((product) => (
                  <div key={product.id} className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-blue-900">{product.product?.name || 'Unknown Product'}</h4>
                        {product.source === 'lead_creation' && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                            Initial
                          </span>
                        )}
                        {product.source === 'manual_add' && (
                          <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                            Added
                          </span>
                        )}
                        {product.source === 'both' && (
                          <span className="px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                            Updated
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${
                        product.interestLevel === 'HIGH' ? 'bg-red-100 text-red-800' :
                        product.interestLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                        product.interestLevel === 'LOW' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {product.interestLevel}
                      </span>
                    </div>
                    <p className="text-sm text-blue-700 mb-2">Quantity: {product.quantity}</p>
                    {product.product?.sku && (
                      <p className="text-xs text-blue-600">SKU: {product.product.sku}</p>
                    )}
                    {product.notes && (
                      <p className="text-sm text-gray-600 mt-2">{product.notes}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      {product.source === 'lead_creation' ? 'Initial interest' : 'Added'} {new Date(product.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No products interested</p>
              </div>
            )}
          </Card>

          {/* Users */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Assigned Users</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddUserModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {assignedUsers.length > 0 ? (
              <div className="space-y-3">
                {assignedUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <User className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      {user.role && (
                        <p className="text-xs text-blue-600">{user.role}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No users assigned</p>
              </div>
            )}
          </Card>

          {/* Sources */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Sources</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  success('Add Source clicked! (Feature coming soon)');
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {(lead.source || (Array.isArray(sources) && sources.length > 0)) ? (
              <div className="space-y-2">
                {/* Lead's primary source */}
                {lead.source && (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">{lead.source}</span>
                    </div>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">Primary</span>
                  </div>
                )}
                
                {/* Additional sources */}
                {Array.isArray(sources) && sources.slice(0, lead.source ? 2 : 3).map((source: any) => (
                  <div key={source.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">{source.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{source.category}</span>
                  </div>
                ))}
                
                {Array.isArray(sources) && (sources.length > (lead.source ? 2 : 3)) && (
                  <p className="text-xs text-gray-500 text-center mt-2">
                    +{sources.length - (lead.source ? 2 : 3)} more sources
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Link className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No sources assigned</p>
              </div>
            )}
          </Card>

          {/* Emails */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Emails</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddEmailModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {emailHistory && emailHistory.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {emailHistory.map((email) => (
                  <div key={email.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{email.subject}</h4>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{email.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            email.status === 'SENT' ? 'bg-green-100 text-green-800' :
                            email.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            email.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {email.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {email.sentAt ? new Date(email.sentAt).toLocaleDateString() : 'Not sent'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No emails sent</p>
              </div>
            )}
          </Card>

          {/* SMS */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">SMS</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddSMSModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {smsHistory && smsHistory.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {smsHistory.map((sms) => (
                  <div key={sms.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{sms.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            sms.status === 'SENT' ? 'bg-green-100 text-green-800' :
                            sms.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                            sms.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {sms.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {sms.sentAt ? new Date(sms.sentAt).toLocaleDateString() : 'Not sent'}
                          </span>
                          <span className="text-xs text-gray-500">
                            To: {sms.to}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No SMS sent</p>
              </div>
            )}
          </Card>

          {/* Comments */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Comments</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddCommentModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {comments.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-sm text-gray-900">
                          {comment.createdByUser?.name || 'Unknown User'}
                        </span>
                        {comment.isInternal && (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Internal
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No comments</p>
              </div>
            )}
          </Card>

          {/* Files */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Files</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddFileModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {files.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {files.map((file) => (
                  <div key={file.id} className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {file.fileName}
                        </span>
                        <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                          {file.category}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                    {file.description && (
                      <p className="text-sm text-gray-600 mb-2">{file.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {file.uploadedByUser?.name || 'Unknown User'}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {(file.fileSize / 1024).toFixed(1)} KB
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => window.open(file.filePath, '_blank')}
                        >
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No files attached</p>
              </div>
            )}
          </Card>

          {/* Meetings & Calls */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Meetings & Calls</h3>
              <Button 
                variant="outline" 
                size="sm"
                className="hover:bg-blue-50 hover:border-blue-300 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowAddMeetingModal(true);
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {meetings.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-3">
                {meetings.slice(0, 3).map((meeting) => (
                  <div key={meeting.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                      <span className={`px-2 py-1 text-xs rounded ${
                        meeting.status === 'SCHEDULED' ? 'bg-yellow-100 text-yellow-800' :
                        meeting.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                        meeting.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {meeting.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{meeting.type}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(meeting.scheduledAt).toLocaleDateString()} at {new Date(meeting.scheduledAt).toLocaleTimeString()}
                    </p>
                    <p className="text-xs text-gray-500">Duration: {meeting.duration} minutes</p>
                    {meeting.description && (
                      <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                    )}
                  </div>
                ))}
                {meetings.length > 3 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    +{meetings.length - 3} more meetings
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Video className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No meetings scheduled</p>
              </div>
            )}
          </Card>
        </div>

        {/* Activity Timeline */}
        <Card className="p-6 mt-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full bg-${theme.primaryBg}`}>
                <Activity className={`w-5 h-5 text-${theme.primary}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
                <p className="text-sm text-gray-600">
                  Track the lead's journey from creation to conversion
                  {activities.length > 0 && (
                    <span className="ml-2 text-blue-600">({activities.length} activities)</span>
                  )}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowAllActivities(!showAllActivities)}
            >
              <History className="w-4 h-4 mr-2" />
              {showAllActivities ? 'Show Less' : 'View All'}
            </Button>
          </div>
          
          <div className="space-y-4">
            {(showAllActivities ? activities : activities.slice(0, 4)).map((activity, index) => {
              const IconComponent = activity.icon;
              const isLastInView = showAllActivities ? index === activities.length - 1 : index === 3;
              const isLastOverall = index === activities.length - 1;
              return (
                <div key={activity.id} className="relative flex items-start gap-4">
                  <div className="relative">
                    <div className={`p-2 rounded-full ${activity.color} text-white`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    {!isLastInView && !isLastOverall && (
                      <div className="absolute left-1/2 transform -translate-x-1/2 mt-2 w-0.5 h-8 bg-gray-200"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-900">{activity.title}</h4>
                      <span className="text-xs text-gray-500">{formatTimestamp(activity.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-1">by {activity.user}</p>
                  </div>
                </div>
              );
            })}
            {!showAllActivities && activities.length > 4 && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">
                  Showing 4 of {activities.length} activities
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Modals */}
      {showEditModal && lead && (
        <EditLeadModal
          lead={lead}
          onClose={() => setShowEditModal(false)}
          onSave={handleEditLead}
        />
      )}

      {showDeleteModal && (
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteLead}
          title="Delete Lead"
          message={`Are you sure you want to delete ${lead?.firstName} ${lead?.lastName}? This action cannot be undone.`}
          itemName="lead"
        />
      )}

      {showAddTaskModal && (
        <AddLeadTaskModal
          isOpen={showAddTaskModal}
          onClose={() => {
            setShowAddTaskModal(false);
            setTaskInitialData(null);
          }}
          onSave={handleAddTask}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
          initialData={taskInitialData || undefined}
        />
      )}

      {showAddCommentModal && (
        <AddLeadCommentModal
          isOpen={showAddCommentModal}
          onClose={() => setShowAddCommentModal(false)}
          onSave={handleAddComment}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
        />
      )}

      {showAddFileModal && (
        <AddLeadFileModal
          isOpen={showAddFileModal}
          onClose={() => setShowAddFileModal(false)}
          onSave={handleAddFile}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
        />
      )}

      {showAddEmailModal && (
        <AddLeadEmailModal
          isOpen={showAddEmailModal}
          onClose={() => setShowAddEmailModal(false)}
          onSave={handleAddEmail}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
          leadEmail={lead?.email || ''}
        />
      )}

      {showAddSMSModal && (
        <AddLeadSMSModal
          isOpen={showAddSMSModal}
          onClose={() => setShowAddSMSModal(false)}
          onSave={handleAddSMS}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
          leadPhone={lead?.phone || ''}
        />
      )}

      {showAddProductModal && (
        <AddLeadProductModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          onSave={handleAddProduct}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
        />
      )}

      {showAddUserModal && (
        <AddLeadUserModal
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onSave={handleAddUser}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
        />
      )}

      {showAddMeetingModal && (
        <AddLeadMeetingModal
          isOpen={showAddMeetingModal}
          onClose={() => setShowAddMeetingModal(false)}
          onSave={handleAddMeeting}
          leadId={lead?.id || ''}
          leadName={lead ? `${lead.firstName} ${lead.lastName}` : ''}
        />
      )}

      {selectedTask && (
        <TaskSlideout
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => {
            setSelectedTask(null);
            // Refresh tasks when slideout is closed in case task was updated
            fetchTasks();
          }}
        />
      )}

      {showQuoteConfirmationModal && lead && (
        <LeadToQuoteConfirmationModal
          isOpen={showQuoteConfirmationModal}
          onClose={() => setShowQuoteConfirmationModal(false)}
          onConfirm={handleConfirmCreateQuote}
          leadData={{
            name: `${lead.firstName} ${lead.lastName}`,
            email: lead.email || '',
            phone: lead.phone || '',
            company: lead.company || '',
          }}
        />
      )}
    </>
  );
}
