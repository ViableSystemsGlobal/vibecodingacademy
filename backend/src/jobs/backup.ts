import { exec } from 'child_process';
import { promisify } from 'util';
import { config } from '../config/env';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export async function backupDatabase() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'backups');
    const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Extract database connection details from DATABASE_URL
    const dbUrl = new URL(config.database.url);
    const dbName = dbUrl.pathname.slice(1);
    const dbUser = dbUrl.username;
    const dbPassword = dbUrl.password;
    const dbHost = dbUrl.hostname;
    const dbPort = dbUrl.port || '5432';

    // Run pg_dump
    const command = `PGPASSWORD=${dbPassword} pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f ${backupFile}`;

    await execAsync(command);

    console.log(`Database backup created: ${backupFile}`);

    // Clean up old backups (keep last 7 days)
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < sevenDaysAgo) {
        fs.unlinkSync(filePath);
        console.log(`Deleted old backup: ${file}`);
      }
    });

    return backupFile;
  } catch (error) {
    console.error('Backup error:', error);
    throw error;
  }
}

