import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFile } from 'fs/promises';
import { getDatabasePath, getUploadDirectories, getAllFiles } from '@/lib/db-utils';
import archiver from 'archiver';
import { join, relative } from 'path';
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
        { error: 'Database backup is only available for SQLite databases. For PostgreSQL, please use pg_dump.' },
        { status: 400 }
      );
    }

    // Check if database exists
    if (!existsSync(dbPath)) {
      return NextResponse.json(
        { error: 'Database file not found' },
        { status: 404 }
      );
    }

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

    // Add database file to archive
    const dbBuffer = await readFile(dbPath);
    const dbFileName = dbPath.split(/[/\\]/).pop() || 'database.db';
    archive.append(dbBuffer, { name: `database/${dbFileName}` });

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
      databaseSize: dbBuffer.length,
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

