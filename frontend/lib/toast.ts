import { toast } from 'sonner';

/**
 * Toast notification helpers for consistent messaging across the app
 */
export const showToast = {
  success: (message: string) => {
    toast.success(message);
  },
  error: (message: string) => {
    toast.error(message);
  },
  info: (message: string) => {
    toast.info(message);
  },
  warning: (message: string) => {
    toast.warning(message);
  },
  loading: (message: string) => {
    return toast.loading(message);
  },
};

