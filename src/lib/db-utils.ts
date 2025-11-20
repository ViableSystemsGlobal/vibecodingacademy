import { join } from 'path';
import { existsSync, statSync, readdirSync, lstatSync } from 'fs';

/**
 * Get the database file path from DATABASE_URL
 * Supports SQLite file paths (file:./path/to/db.db or file:./dev.db)
 */
export function getDatabasePath(): string | null {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    return null;
  }

  // Check if it's a PostgreSQL connection string
  if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
    // PostgreSQL doesn't use file-based backups in the same way
    // This would require pg_dump instead
    return null;
  }

  // Handle SQLite file paths
  if (dbUrl.startsWith('file:')) {
    // Remove 'file:' prefix
    let filePath = dbUrl.replace(/^file:/, '');
    
    // Handle relative paths
    if (filePath.startsWith('./')) {
      filePath = join(process.cwd(), filePath.replace('./', ''));
    } else if (!filePath.startsWith('/')) {
      // Relative path without ./
      filePath = join(process.cwd(), filePath);
    }
    
    return filePath;
  }

  // Default fallback for SQLite
  return join(process.cwd(), 'prisma', 'dev.db');
}

/**
 * Check if database file exists and get its size
 */
export function getDatabaseInfo(): { exists: boolean; size?: number; path?: string } {
  const dbPath = getDatabasePath();
  
  if (!dbPath) {
    return { exists: false };
  }

  try {
    if (existsSync(dbPath)) {
      const stats = statSync(dbPath);
      return {
        exists: true,
        size: stats.size,
        path: dbPath
      };
    }
  } catch (error) {
    console.error('Error getting database info:', error);
  }

  return { exists: false, path: dbPath };
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get all upload directories that should be included in backup
 */
export function getUploadDirectories(): string[] {
  const uploadDirs: string[] = [];
  const baseDirs = [
    join(process.cwd(), 'public', 'uploads'),
    join(process.cwd(), 'uploads'),
    '/app/uploads' // Production path
  ];

  for (const baseDir of baseDirs) {
    if (existsSync(baseDir)) {
      uploadDirs.push(baseDir);
    }
  }

  return uploadDirs;
}

/**
 * Recursively get all files in a directory
 */
export function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!existsSync(dirPath)) {
    return arrayOfFiles;
  }

  try {
    const files = readdirSync(dirPath);

    files.forEach((file) => {
      const filePath = join(dirPath, file);
      if (lstatSync(filePath).isDirectory()) {
        arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
      } else {
        arrayOfFiles.push(filePath);
      }
    });
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return arrayOfFiles;
}

/**
 * Calculate total size of uploads directory
 */
export function getUploadsSize(): { size: number; fileCount: number } {
  let totalSize = 0;
  let fileCount = 0;
  const uploadDirs = getUploadDirectories();

  for (const uploadDir of uploadDirs) {
    const files = getAllFiles(uploadDir);
    fileCount += files.length;
    
    for (const file of files) {
      try {
        const stats = statSync(file);
        totalSize += stats.size;
      } catch (error) {
        // Skip files that can't be accessed
      }
    }
  }

  return { size: totalSize, fileCount };
}

