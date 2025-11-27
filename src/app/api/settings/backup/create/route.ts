import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { getDatabasePath, getUploadDirectories, getAllFiles } from '@/lib/db-utils';
import archiver from 'archiver';
import { join, relative } from 'path';
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
    
    // Create a ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    // Collect chunks for the response
    const chunks: Buffer[] = [];
    let archiveError: Error | null = null;
    
    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('error', (err) => {
      console.error('Archive error:', err);
      archiveError = err;
    });

    let databaseBackedUp = false;
    let dbFileName = 'database.db';
    let dbSize = 0;

    if (isPostgreSQL) {
      // Use pg_dump for PostgreSQL
      try {
        // Parse DATABASE_URL to extract connection details
        const url = new URL(dbUrl);
        const host = url.hostname;
        const port = url.port || '5432';
        const database = url.pathname.slice(1); // Remove leading /
        const username = url.username;
        const password = url.password;

        // Create pg_dump command
        // Use PGPASSWORD environment variable for password
        const pgDumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F c -f /tmp/pg_backup.dump`;

        // Execute pg_dump
        await execAsync(pgDumpCommand, {
          env: { ...process.env, PGPASSWORD: password },
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });

        // Read the dump file
        const dumpBuffer = await readFile('/tmp/pg_backup.dump');
        dbSize = dumpBuffer.length;
        dbFileName = 'database.dump';
        
        archive.append(dumpBuffer, { name: `database/${dbFileName}` });
        databaseBackedUp = true;

        // Clean up temp file
        try {
          await execAsync('rm /tmp/pg_backup.dump');
        } catch (e) {
          // Ignore cleanup errors
        }
      } catch (error: any) {
        console.error('Error creating PostgreSQL backup:', error);
        // Fall back to SQL dump format if custom format fails
        try {
          const url = new URL(dbUrl);
          const host = url.hostname;
          const port = url.port || '5432';
          const database = url.pathname.slice(1);
          const username = url.username;
          const password = url.password;

          const pgDumpCommand = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${username} -d ${database} -F p > /tmp/pg_backup.sql`;

          await execAsync(pgDumpCommand, {
            env: { ...process.env, PGPASSWORD: password },
            maxBuffer: 10 * 1024 * 1024
          });

          const dumpBuffer = await readFile('/tmp/pg_backup.sql');
          dbSize = dumpBuffer.length;
          dbFileName = 'database.sql';
          
          archive.append(dumpBuffer, { name: `database/${dbFileName}` });
          databaseBackedUp = true;

          try {
            await execAsync('rm /tmp/pg_backup.sql');
          } catch (e) {
            // Ignore
          }
        } catch (fallbackError: any) {
          return NextResponse.json(
            { error: `Failed to create PostgreSQL backup: ${fallbackError.message}. Make sure pg_dump is installed and accessible.` },
            { status: 500 }
          );
        }
      }
    } else {
      // SQLite file-based backup
      const dbPath = getDatabasePath();
      
      if (!dbPath) {
        return NextResponse.json(
          { error: 'Could not determine database path' },
          { status: 400 }
        );
      }

      if (!existsSync(dbPath)) {
        return NextResponse.json(
          { error: 'Database file not found' },
          { status: 404 }
        );
      }

      const dbBuffer = await readFile(dbPath);
      dbSize = dbBuffer.length;
      dbFileName = dbPath.split(/[/\\]/).pop() || 'database.db';
      archive.append(dbBuffer, { name: `database/${dbFileName}` });
      databaseBackedUp = true;
    }

    if (!databaseBackedUp) {
      return NextResponse.json(
        { error: 'Failed to backup database' },
        { status: 500 }
      );
    }

    // Add all uploaded files
    const uploadDirs = getUploadDirectories();
    let filesAdded = 0;
    const manifest: { type: string; files: string[] }[] = [];

    for (const uploadDir of uploadDirs) {
      if (existsSync(uploadDir)) {
        const files = getAllFiles(uploadDir);
        const dirName = uploadDir.split(/[/\\]/).pop() || 'uploads';
        const manifestFiles: string[] = [];

        for (const file of files) {
          try {
            const relativePath = relative(uploadDir, file);
            const archivePath = `uploads/${dirName}/${relativePath}`;
            
            archive.file(file, { name: archivePath });
            manifestFiles.push(archivePath);
            filesAdded++;
          } catch (error) {
            console.error(`Error adding file ${file} to archive:`, error);
          }
        }

        if (manifestFiles.length > 0) {
          manifest.push({
            type: dirName,
            files: manifestFiles
          });
        }
      }
    }

    // Add manifest file
    const manifestData = {
      backupDate: new Date().toISOString(),
      databaseFile: `database/${dbFileName}`,
      databaseType: isPostgreSQL ? 'postgresql' : 'sqlite',
      databaseSize: dbSize,
      uploadDirectories: manifest,
      totalFiles: filesAdded + 1, // +1 for database
      version: '1.0'
    };
    
    archive.append(JSON.stringify(manifestData, null, 2), { name: 'manifest.json' });

    // Finalize the archive
    archive.finalize();

    // Wait for archive to finish
    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => {
        if (archiveError) {
          reject(archiveError);
        } else {
          resolve();
        }
      });
      
      archive.on('error', (err) => {
        reject(err);
      });
    });

    // Combine all chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    // Create a filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `adpools-backup-${timestamp}.zip`;

    // Return the ZIP file as a download
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString()
      }
    });

  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { error: 'Failed to create backup: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
