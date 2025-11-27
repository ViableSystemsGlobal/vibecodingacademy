import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { getDatabasePath, getUploadDirectories } from '@/lib/db-utils';
import AdmZip from 'adm-zip';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get database path dynamically
    const dbPath = getDatabasePath();
    
    if (!dbPath) {
      return NextResponse.json(
        { error: 'Database restore is only available for SQLite databases. For PostgreSQL, please use pg_restore.' },
        { status: 400 }
      );
    }

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Check if it's a ZIP file (new format) or old .db/.sql file
    const isZip = file.name.endsWith('.zip');
    const isOldFormat = file.name.endsWith('.db') || file.name.endsWith('.sql');

    if (!isZip && !isOldFormat) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .zip, .db, or .sql file' },
        { status: 400 }
      );
    }

    if (isZip) {
      // Handle ZIP backup (database + files)
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      let databaseRestored = false;
      let filesRestored = 0;

      // Extract all files
      for (const entry of zipEntries) {
        if (entry.isDirectory) {
          continue;
        }

        const entryName = entry.entryName;

        // Restore database file
        if (entryName.startsWith('database/')) {
          const dbFileName = entryName.replace('database/', '');
          // Use the actual database path, not the filename from archive
          await writeFile(dbPath, entry.getData());
          databaseRestored = true;
          continue;
        }

        // Restore uploaded files
        if (entryName.startsWith('uploads/')) {
          const relativePath = entryName.replace('uploads/', '');
          const parts = relativePath.split('/');
          const uploadDirName = parts[0];
          const filePath = parts.slice(1).join('/');

          // Determine target directory
          let targetDir: string;
          const uploadDirs = getUploadDirectories();
          
          // Try to find matching upload directory
          if (uploadDirs.length > 0) {
            // Use the first available upload directory as base
            const baseDir = uploadDirs[0];
            // If it's public/uploads, use that structure
            if (baseDir.includes('public/uploads')) {
              targetDir = join(process.cwd(), 'public', 'uploads', uploadDirName);
            } else {
              targetDir = join(process.cwd(), 'uploads', uploadDirName);
            }
          } else {
            // Fallback to default
            targetDir = join(process.cwd(), 'public', 'uploads', uploadDirName);
          }

          // Create directory if it doesn't exist
          const fullFilePath = join(targetDir, filePath);
          const fileDir = dirname(fullFilePath);
          
          if (!existsSync(fileDir)) {
            await mkdir(fileDir, { recursive: true });
          }

          // Write file
          await writeFile(fullFilePath, entry.getData());
          filesRestored++;
        }
      }

      if (!databaseRestored) {
        return NextResponse.json(
          { error: 'Database file not found in backup archive' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Backup restored successfully. Database and ${filesRestored} files restored.`
      });

    } else {
      // Handle old format (database only)
    await writeFile(dbPath, buffer);

    return NextResponse.json({
      success: true,
        message: 'Database restored successfully (legacy format - files not included)'
    });
    }

  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

