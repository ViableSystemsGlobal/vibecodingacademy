import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { requestLogger } from './middleware/request-logger';
import { startReminderCron } from './jobs/reminder-cron';
import { startPaymentReminderCron } from './jobs/payment-reminder-cron';

const app: Express = express();

// Trust proxy (important for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", config.frontendUrl],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow embedding for iframes (YouTube videos)
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources (images)
}));

// Request logging
app.use(requestLogger);

// CORS configuration - more restrictive in production
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = [
      config.frontendUrl,
      ...(config.nodeEnv === 'development' 
        ? ['http://localhost:3004', 'http://localhost:3005', 'http://localhost:3000']
        : []
      ),
    ];

    // In production, be strict about origins
    if (config.nodeEnv === 'production') {
      // Allow requests with no origin only for health checks
      if (!origin) {
        return callback(null, true);
      }
      
      // Only allow configured frontend URL in production
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, be more permissive
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// Apply rate limiting to all API routes
app.use(apiLimiter);

// Special handling for webhooks - need raw body for signature verification
app.use('/webhooks/paystack', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin';
import publicRoutes from './routes/public.routes';
import webhookRoutes from './routes/webhooks.routes';
import parentRoutes from './routes/parent.routes';
import studentRoutes from './routes/student.routes';
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/public', publicRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/parent', parentRoutes);
app.use('/student', studentRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
  
  // Start cron jobs
  if (config.nodeEnv === 'production') {
    startReminderCron();
    console.log('Class reminder cron job started');
    startPaymentReminderCron();
    console.log('Payment reminder cron job started');
  } else {
    // Also start in development for testing
    console.log('Starting cron jobs in development mode...');
    startReminderCron();
    startPaymentReminderCron();
  }
});

export default app;

