'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/contexts/theme-context';
import { useToast } from '@/contexts/toast-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  MapPin, 
  Key, 
  Settings, 
  CheckCircle, 
  AlertCircle,
  Info,
  ExternalLink,
  Save,
  TestTube
} from 'lucide-react';

interface GoogleMapsConfig {
  apiKey: string;
  enabled: boolean;
  geocodingEnabled: boolean;
  placesEnabled: boolean;
  directionsEnabled: boolean;
  mapsEnabled: boolean;
  usageQuota: number;
  currentUsage: number;
  lastUpdated: string;
}

export default function GoogleMapsSettingsPage() {
  const { data: session } = useSession();
  const { getThemeClasses } = useTheme();
  const themeClasses = getThemeClasses();
  const { success, error } = useToast();

  const [config, setConfig] = useState<GoogleMapsConfig>({
    apiKey: '',
    enabled: false,
    geocodingEnabled: true,
    placesEnabled: true,
    directionsEnabled: true,
    mapsEnabled: true,
    usageQuota: 1000,
    currentUsage: 0,
    lastUpdated: new Date().toISOString(),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/settings/google-maps', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config || config);
      }
    } catch (err) {
      console.error('Error loading Google Maps config:', err);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/settings/google-maps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        credentials: 'include',
      });

      if (response.ok) {
        success('Google Maps configuration saved successfully!');
        await loadConfig();
      } else {
        const errorData = await response.json();
        error(errorData.error || 'Failed to save configuration');
      }
    } catch (err) {
      console.error('Error saving config:', err);
      error('Failed to save configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestApiKey = async () => {
    if (!config.apiKey) {
      error('Please enter an API key first');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/settings/google-maps/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: config.apiKey }),
        credentials: 'include',
      });

      const result = await response.json();
      
      if (response.ok) {
        setTestResult({ success: true, message: result.message });
        success('API key test successful!');
      } else {
        setTestResult({ success: false, message: result.error });
        error('API key test failed');
      }
    } catch (err) {
      setTestResult({ success: false, message: 'Network error during test' });
      error('Failed to test API key');
    } finally {
      setIsTesting(false);
    }
  };

  const handleInputChange = (field: keyof GoogleMapsConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!session?.user) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600">Please sign in to access settings.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Google Maps Settings</h1>
            <p className="text-sm sm:text-base text-gray-600">Configure Google Maps API for location services and routing</p>
          </div>
        </div>

        {/* API Key Configuration */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Key className="h-5 w-5 mr-2 text-blue-600" />
            <h2 className="text-xl font-semibold">API Key Configuration</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="apiKey">Google Maps API Key *</Label>
              <div className="flex gap-2">
                <Input
                  id="apiKey"
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                  placeholder="Enter your Google Maps API key"
                  className="flex-1"
                />
                <Button
                  onClick={handleTestApiKey}
                  disabled={isTesting || !config.apiKey}
                  variant="outline"
                  className="flex items-center"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTesting ? 'Testing...' : 'Test'}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Get your API key from the{' '}
                <a 
                  href="https://console.cloud.google.com/apis/credentials" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center"
                >
                  Google Cloud Console
                  <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </p>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg flex items-center ${
                testResult.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                )}
                <span className={`text-sm ${
                  testResult.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.message}
                </span>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="enabled"
                checked={config.enabled}
                onChange={(e) => handleInputChange('enabled', e.target.checked)}
                className="mr-2"
              />
              <Label htmlFor="enabled">Enable Google Maps Services</Label>
            </div>
          </div>
        </Card>

        {/* Service Configuration */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Settings className="h-5 w-5 mr-2 text-blue-600" />
            <h2 className="text-xl font-semibold">Service Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="geocodingEnabled"
                  checked={config.geocodingEnabled}
                  onChange={(e) => handleInputChange('geocodingEnabled', e.target.checked)}
                  className="mr-2"
                />
                <Label htmlFor="geocodingEnabled">Geocoding API</Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                Convert addresses to coordinates and vice versa
              </p>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="placesEnabled"
                  checked={config.placesEnabled}
                  onChange={(e) => handleInputChange('placesEnabled', e.target.checked)}
                  className="mr-2"
                />
                <Label htmlFor="placesEnabled">Places API</Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                Search for businesses and points of interest
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="directionsEnabled"
                  checked={config.directionsEnabled}
                  onChange={(e) => handleInputChange('directionsEnabled', e.target.checked)}
                  className="mr-2"
                />
                <Label htmlFor="directionsEnabled">Directions API</Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                Calculate routes and travel times
              </p>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mapsEnabled"
                  checked={config.mapsEnabled}
                  onChange={(e) => handleInputChange('mapsEnabled', e.target.checked)}
                  className="mr-2"
                />
                <Label htmlFor="mapsEnabled">Maps JavaScript API</Label>
              </div>
              <p className="text-sm text-gray-500 ml-6">
                Display interactive maps
              </p>
            </div>
          </div>
        </Card>

        {/* Usage Information */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <Info className="h-5 w-5 mr-2 text-blue-600" />
            <h2 className="text-xl font-semibold">Usage Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Monthly Quota</Label>
              <Input
                type="number"
                value={config.usageQuota}
                onChange={(e) => handleInputChange('usageQuota', parseInt(e.target.value) || 0)}
                placeholder="1000"
              />
            </div>
            <div>
              <Label>Current Usage</Label>
              <Input
                type="number"
                value={config.currentUsage}
                onChange={(e) => handleInputChange('currentUsage', parseInt(e.target.value) || 0)}
                placeholder="0"
                disabled
              />
            </div>
            <div>
              <Label>Last Updated</Label>
              <Input
                value={new Date(config.lastUpdated).toLocaleDateString()}
                disabled
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Usage Progress</span>
              <span>{config.currentUsage} / {config.usageQuota}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full ${
                  (config.currentUsage / config.usageQuota) > 0.8 
                    ? 'bg-red-500' 
                    : (config.currentUsage / config.usageQuota) > 0.6 
                    ? 'bg-yellow-500' 
                    : 'bg-green-500'
                }`}
                style={{ width: `${Math.min((config.currentUsage / config.usageQuota) * 100, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* Setup Instructions */}
        <Card className="p-6">
          <div className="flex items-center mb-4">
            <MapPin className="h-5 w-5 mr-2 text-blue-600" />
            <h2 className="text-xl font-semibold">Setup Instructions</h2>
          </div>
          
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-medium mb-2">1. Create Google Cloud Project</h3>
              <p className="text-gray-600">
                Go to the Google Cloud Console and create a new project or select an existing one.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">2. Enable Required APIs</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Geocoding API</li>
                <li>Places API</li>
                <li>Directions API</li>
                <li>Maps JavaScript API</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">3. Create API Key</h3>
              <p className="text-gray-600">
                Create an API key in the Credentials section and restrict it to your domain for security.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">4. Set Usage Quotas</h3>
              <p className="text-gray-600">
                Set daily/monthly quotas to control costs and prevent unexpected charges.
              </p>
            </div>
          </div>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading}
            className={`bg-${themeClasses.primary} hover:bg-${themeClasses.primaryDark} text-white`}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </div>
    </>
  );
}
