import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { getDatabasePath, getUploadDirectories } from '@/lib/db-utils';
import AdmZip from 'adm-zip';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

    // Get the uploaded file
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Check if it's a ZIP file (new format) or old .db/.sql/.dump file
    const isZip = file.name.endsWith('.zip');
    const isOldFormat = file.name.endsWith('.db') || file.name.endsWith('.sql') || file.name.endsWith('.dump');

    if (!isZip && !isOldFormat) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a .zip, .db, .sql, or .dump file' },
        { status: 400 }
      );
    }

    if (isZip) {
      // Handle ZIP backup (database + files)
      const zip = new AdmZip(buffer);
      const zipEntries = zip.getEntries();
      
      // Read manifest to determine database type
      let manifest: any = null;
      let databaseEntry: any = null;
      let databaseType = 'sqlite';

      for (const entry of zipEntries) {
        if (entry.entryName === 'manifest.json') {
          manifest = JSON.parse(entry.getData().toString());
          databaseType = manifest.databaseType || 'sqlite';
        }
        if (entry.entryName.startsWith('database/')) {
          databaseEntry = entry;
        }
      }

      if (!databaseEntry) {
        return NextResponse.json(
          { error: 'Database file not found in backup archive' },
          { status: 400 }
        );
      }
      
      let databaseRestored = false;
      let filesRestored = 0;

      // Restore database
      if (isPostgreSQL) {
        // PostgreSQL restore
        try {
          const url = new URL(dbUrl);
          const host = url.hostname;
          const port = url.port || '5432';
          const database = url.pathname.slice(1);
          const username = url.username;
          const password = url.password;

          const dbData = databaseEntry.getData();
          const dbFileName = databaseEntry.entryName.replace('database/', '');

          // Save dump to temp file
          const tempFile = `/tmp/pg_restore_${Date.now()}.${dbFileName.endsWith('.sql') ? 'sql' : 'dump'}`;
          await writeFile(tempFile, dbData);

          if (dbFileName.endsWith('.dump')) {
            // Custom format - use pg_restore
            const pgRestoreCommand = `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${database} --clean --if-exists ${tempFile}`;
            
            await execAsync(pgRestoreCommand, {
              env: { ...process.env, PGPASSWORD: password },
              maxBuffer: 10 * 1024 * 1024
            });
          } else {
            // SQL format - use psql
            const psqlCommand = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${username} -d ${database} -f ${tempFile}`;
            
            await execAsync(psqlCommand, {
              env: { ...process.env, PGPASSWORD: password },
              maxBuffer: 10 * 1024 * 1024
            });
          }

          // Clean up temp file
          try {
            await execAsync(`rm ${tempFile}`);
          } catch (e) {
            // Ignore cleanup errors
          }

          databaseRestored = true;
        } catch (error: any) {
          console.error('Error restoring PostgreSQL database:', error);
          return NextResponse.json(
            { error: `Failed to restore PostgreSQL database: ${error.message}. Make sure pg_restore/psql is installed and accessible.` },
            { status: 500 }
          );
        }
      } else {
        // SQLite restore
        const dbPath = getDatabasePath();
        
        if (!dbPath) {
          return NextResponse.json(
            { error: 'Could not determine database path' },
            { status: 400 }
          );
        }

        await writeFile(dbPath, databaseEntry.getData());
        databaseRestored = true;
      }

      // Restore uploaded files
      for (const entry of zipEntries) {
        if (entry.isDirectory) {
          continue;
        }

        const entryName = entry.entryName;

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
          { error: 'Failed to restore database' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Backup restored successfully. Database and ${filesRestored} files restored.`
      });

    } else {
      // Handle old format (database only)
      if (isPostgreSQL) {
        // PostgreSQL restore from .sql or .dump file
        try {
          const url = new URL(dbUrl);
          const host = url.hostname;
          const port = url.port || '5432';
          const database = url.pathname.slice(1);
          const username = url.username;
          const password = url.password;

          const tempFile = `/tmp/pg_restore_${Date.now()}.${file.name.endsWith('.dump') ? 'dump' : 'sql'}`;
          await writeFile(tempFile, buffer);

          if (file.name.endsWith('.dump')) {
            const pgRestoreCommand = `PGPASSWORD="${password}" pg_restore -h ${host} -p ${port} -U ${username} -d ${database} --clean --if-exists ${tempFile}`;
            
            await execAsync(pgRestoreCommand, {
              env: { ...process.env, PGPASSWORD: password },
              maxBuffer: 10 * 1024 * 1024
            });
          } else {
            const psqlCommand = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${username} -d ${database} -f ${tempFile}`;
            
            await execAsync(psqlCommand, {
              env: { ...process.env, PGPASSWORD: password },
              maxBuffer: 10 * 1024 * 1024
            });
          }

          try {
            await execAsync(`rm ${tempFile}`);
          } catch (e) {
            // Ignore
          }

          return NextResponse.json({
            success: true,
            message: 'Database restored successfully (legacy format - files not included)'
          });
        } catch (error: any) {
          return NextResponse.json(
            { error: `Failed to restore PostgreSQL database: ${error.message}` },
            { status: 500 }
          );
        }
      } else {
        // SQLite restore
        const dbPath = getDatabasePath();
        
        if (!dbPath) {
          return NextResponse.json(
            { error: 'Could not determine database path' },
            { status: 400 }
          );
        }

    await writeFile(dbPath, buffer);

    return NextResponse.json({
      success: true,
        message: 'Database restored successfully (legacy format - files not included)'
    });
      }
    }

  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: 'Failed to restore backup: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
