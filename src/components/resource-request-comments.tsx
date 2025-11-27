'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/contexts/toast-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  MessageCircle, 
  Send, 
  Edit, 
  Trash2, 
  MoreVertical,
  User
} from 'lucide-react';
import { DropdownMenu } from '@/components/ui/dropdown-menu-custom';

interface ResourceRequestComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string;
  };
}

interface ResourceRequestCommentsProps {
  projectId: string;
  requestId: string;
  className?: string;
}

export function ResourceRequestComments({ projectId, requestId, className = '' }: ResourceRequestCommentsProps) {
  const { data: session } = useSession();
  const { success: showSuccess, error: showError } = useToast();
  
  const [comments, setComments] = useState<ResourceRequestComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const loadComments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/projects/${projectId}/resource-requests/${requestId}/comments`);
      
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
      } else {
        let errorData: any = null;
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          try {
            errorData = await response.json();
          } catch (parseError) {
            console.error('Failed to parse JSON error response:', parseError);
          }
        }
        
        // Construct meaningful error message
        const errorMessage = errorData?.error || errorData?.details;
        const statusText = response.statusText || `HTTP ${response.status}`;
        
        if (errorMessage && typeof errorMessage === 'string' && errorMessage.trim()) {
          console.error(`[RESOURCE-REQUEST-COMMENTS] Failed to load comments: ${errorMessage} (${statusText})`);
          showError(errorMessage);
        } else {
          console.error(`[RESOURCE-REQUEST-COMMENTS] Failed to load comments: ${statusText}`);
          showError(`Failed to load comments (${statusText})`);
        }
      }
    } catch (error) {
      console.error('Error loading comments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[RESOURCE-REQUEST-COMMENTS] Network error: ${errorMessage}`);
      showError(`Failed to load comments: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.id) {
      loadComments();
    } else if (session !== undefined) {
      setIsLoading(false);
    }
  }, [requestId, session, projectId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const response = await fetch(`/api/projects/${projectId}/resource-requests/${requestId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [...prev, data.comment]);
        setNewComment('');
        showSuccess('Comment added successfully');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      showError('Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/resource-requests/${requestId}/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => prev.map(comment => 
          comment.id === commentId ? data.comment : comment
        ));
        setEditingComment(null);
        setEditContent('');
        showSuccess('Comment updated successfully');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to update comment');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
      showError('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/resource-requests/${requestId}/comments/${commentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        showSuccess('Comment deleted successfully');
      } else {
        const errorData = await response.json();
        showError(errorData.error || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      showError('Failed to delete comment');
    }
  };

  const startEditing = (comment: ResourceRequestComment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const cancelEditing = () => {
    setEditingComment(null);
    setEditContent('');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const minutes = Math.floor(diffInHours * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      const hours = Math.floor(diffInHours);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diffInHours < 168) {
      const days = Math.floor(diffInHours / 24);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading || !session?.user?.id) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center gap-2 text-gray-600">
          <MessageCircle className="w-4 h-4" />
          <span className="font-medium">Comments</span>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-gray-600">
        <MessageCircle className="w-4 h-4" />
        <span className="font-medium">Comments ({comments.length})</span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs text-gray-400">Be the first to add a comment</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0">
                {comment.user.image ? (
                  <img
                    src={comment.user.image}
                    alt={comment.user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {comment.user.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(comment.createdAt)}
                      {comment.createdAt !== comment.updatedAt && ' (edited)'}
                    </span>
                  </div>

                  {(session?.user?.id === comment.user.id || 
                    session?.user?.role === 'SUPER_ADMIN' || 
                    session?.user?.role === 'ADMIN') && (
                    <DropdownMenu
                      trigger={
                        <Button variant="ghost" className="h-6 w-6 p-0">
                          <MoreVertical className="h-3 w-3" />
                        </Button>
                      }
                      items={[
                        {
                          label: 'Edit',
                          icon: <Edit className="w-3 h-3 mr-2" />,
                          onClick: () => startEditing(comment)
                        },
                        {
                          label: 'Delete',
                          icon: <Trash2 className="w-3 h-3 mr-2" />,
                          onClick: () => handleDeleteComment(comment.id),
                          className: 'text-red-600'
                        }
                      ]}
                    />
                  )}
                </div>

                {editingComment === comment.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-sm"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleEditComment(comment.id)}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      <form onSubmit={handleSubmitComment} className="space-y-3">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSubmitting ? 'Adding...' : 'Add Comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}

