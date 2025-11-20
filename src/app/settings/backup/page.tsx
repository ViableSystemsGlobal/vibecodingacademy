'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/contexts/toast-context';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Database,
  Download,
  Upload,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
  HardDrive,
  FileArchive,
  Shield
} from 'lucide-react';

interface BackupInfo {
  lastBackup?: string;
  backupSize?: string;
  databaseSize?: string;
  uploadsSize?: string;
  uploadsFileCount?: number;
  totalBackupSize?: string;
  totalRecords?: number;
  databaseExists?: boolean;
  isPostgreSQL?: boolean;
}

export default function BackupSettingsPage() {
  const { success, error: showError } = useToast();
  const { getThemeColor } = useTheme();

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [backupInfo, setBackupInfo] = useState<BackupInfo>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState('daily');

  // Fetch backup info on component mount
  useEffect(() => {
    const fetchBackupInfo = async () => {
      try {
        const response = await fetch('/api/settings/backup/info', {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setBackupInfo({
            databaseSize: data.databaseSize,
            totalRecords: data.totalRecords,
            databaseExists: data.databaseExists,
            isPostgreSQL: data.isPostgreSQL
          });
        }
      } catch (err) {
        console.error('Error fetching backup info:', err);
      } finally {
        setIsLoadingInfo(false);
      }
    };

    fetchBackupInfo();
  }, []);

  const handleBackupDatabase = async () => {
    setIsBackingUp(true);
    try {
      const response = await fetch('/api/settings/backup/create', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create backup');
      }

      // Get the blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adpools-backup-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success('Backup created successfully (database + all files)');
      
      // Update backup info
      setBackupInfo({
        ...backupInfo,
        lastBackup: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error creating backup:', err);
      showError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.zip') || file.name.endsWith('.db') || file.name.endsWith('.sql')) {
        setSelectedFile(file);
      } else {
        showError('Please select a valid backup file (.zip, .db, or .sql)');
      }
    }
  };

  const handleRestoreDatabase = async () => {
    if (!selectedFile) {
      showError('Please select a backup file to restore');
      return;
    }

    // Confirm restoration
    const confirmed = window.confirm(
      '⚠️ WARNING: Restoring a backup will overwrite your current database. This action cannot be undone. Are you sure you want to continue?'
    );

    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/settings/backup/restore', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to restore backup');
      }

      success('Database restored successfully. Please refresh the page.');
      
      // Clear selected file
      setSelectedFile(null);
      
      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      console.error('Error restoring backup:', err);
      showError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleExportData = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/settings/backup/export?format=${format}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to export data');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `adpools-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      success(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Error exporting data:', err);
      showError(err instanceof Error ? err.message : 'Failed to export data');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Database className="h-8 w-8 mr-3" style={{ color: getThemeColor() }} />
            Backup & Restore
          </h1>
          <p className="text-gray-600 mt-1">Manage your database backups and data exports</p>
        </div>
      </div>

      {/* Warning Banner */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-yellow-900">Important Backup Information</h3>
              <p className="text-sm text-yellow-800 mt-1">
                Regular backups are essential for data protection. We recommend backing up your database before major updates or changes. 
                Store backups in a secure location separate from your production environment.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Database Info */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Backup</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {backupInfo.lastBackup 
                    ? new Date(backupInfo.lastBackup).toLocaleDateString() 
                    : 'Never'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Clock className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Database Size</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {isLoadingInfo ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    backupInfo.databaseSize || 'N/A'
                  )}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <HardDrive className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Uploaded Files</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {isLoadingInfo ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    backupInfo.uploadsFileCount?.toLocaleString() || '0'
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {backupInfo.uploadsSize || '0 Bytes'}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <FileArchive className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">
                  {isLoadingInfo ? (
                    <Loader2 className="h-4 w-4 animate-spin inline" />
                  ) : (
                    backupInfo.totalRecords?.toLocaleString() || '0'
                  )}
                </p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PostgreSQL Warning */}
      {backupInfo.isPostgreSQL && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">PostgreSQL Database Detected</h3>
                <p className="text-sm text-blue-800 mt-1">
                  You are using PostgreSQL. File-based backup/restore is not available. 
                  Please use <code className="bg-blue-100 px-1 rounded">pg_dump</code> and <code className="bg-blue-100 px-1 rounded">pg_restore</code> for database backups.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backup Database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2" style={{ color: getThemeColor() }} />
            Create Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Create a complete backup of your database and all uploaded files. This will download a ZIP archive containing:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside mt-2 space-y-1">
            <li>Database file (all records, settings, and configurations)</li>
            <li>All uploaded images (products, categories, branding, banners, etc.)</li>
            <li>All uploaded documents (task attachments, product documents, etc.)</li>
            <li>Manifest file with backup information</li>
          </ul>
          {backupInfo.uploadsFileCount && backupInfo.uploadsFileCount > 0 && (
            <p className="text-sm text-gray-500 mt-2">
              Total files to backup: {backupInfo.uploadsFileCount + 1} files 
              {backupInfo.totalBackupSize && ` (~${backupInfo.totalBackupSize})`}
            </p>
          )}
          {backupInfo.isPostgreSQL && (
            <p className="text-sm text-orange-600 font-medium mt-2">
              Note: File-based backup is only available for SQLite databases.
            </p>
          )}

          <div className="flex items-center space-x-4">
            <Button
              onClick={handleBackupDatabase}
              disabled={isBackingUp || backupInfo.isPostgreSQL}
              className="flex items-center"
              style={{ backgroundColor: getThemeColor(), color: 'white' }}
            >
              {isBackingUp ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isBackingUp ? 'Creating Backup...' : 'Create Backup'}
            </Button>

            <div className="flex items-center text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 mr-1 text-green-600" />
              <span>Full database backup</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restore Database */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="h-5 w-5 mr-2 text-orange-600" />
            Restore Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900">Warning</h4>
                <p className="text-sm text-red-800 mt-1">
                  Restoring a backup will replace your current database. All existing data will be lost.
                  Make sure you have a current backup before proceeding.
                  {backupInfo.isPostgreSQL && (
                    <span className="block mt-2 text-orange-600 font-medium">
                      Note: File-based restore is only available for SQLite databases.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Backup File
            </label>
            <input
              type="file"
              accept=".zip,.db,.sql"
              onChange={handleFileSelect}
              disabled={backupInfo.isPostgreSQL}
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              Supports: .zip (full backup with files), .db or .sql (database only - legacy format)
            </p>
            {selectedFile && (
              <p className="text-sm text-green-600 mt-2 flex items-center">
                <CheckCircle className="h-4 w-4 mr-1" />
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          <Button
            onClick={handleRestoreDatabase}
            disabled={!selectedFile || isRestoring || backupInfo.isPostgreSQL}
            variant="outline"
            className="flex items-center border-red-300 text-red-700 hover:bg-red-50"
          >
            {isRestoring ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {isRestoring ? 'Restoring...' : 'Restore Backup'}
          </Button>
        </CardContent>
      </Card>

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileArchive className="h-5 w-5 mr-2 text-blue-600" />
            Export Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Export your data in different formats for reporting, analysis, or migration purposes.
          </p>

          <div className="flex items-center space-x-4">
            <Button
              onClick={() => handleExportData('json')}
              variant="outline"
              className="flex items-center"
            >
              <FileArchive className="h-4 w-4 mr-2" />
              Export as JSON
            </Button>

            <Button
              onClick={() => handleExportData('csv')}
              variant="outline"
              className="flex items-center"
            >
              <FileArchive className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Automatic Backups (Future Feature) */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-purple-600" />
            Automatic Backups
            <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">Coming Soon</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium text-gray-900">Enable Automatic Backups</label>
              <p className="text-sm text-gray-600">Automatically backup your database on a schedule</p>
            </div>
            <label className="relative inline-flex items-center cursor-not-allowed">
              <input
                type="checkbox"
                checked={autoBackupEnabled}
                onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                disabled
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backup Frequency
            </label>
            <select
              value={backupFrequency}
              onChange={(e) => setBackupFrequency(e.target.value)}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-100 cursor-not-allowed"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-900">
            <Shield className="h-5 w-5 mr-2" />
            Backup Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-blue-900">
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
              <span>Create backups before making major changes to your system</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
              <span>Store backups in multiple secure locations (cloud storage, external drives)</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
              <span>Test your backups regularly to ensure they can be restored</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
              <span>Keep multiple backup versions (don't overwrite old backups)</span>
            </li>
            <li className="flex items-start">
              <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-blue-600" />
              <span>Backup before and after bulk data imports or exports</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

