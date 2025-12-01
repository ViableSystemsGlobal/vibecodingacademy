"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { useTheme } from "@/contexts/theme-context";
import { User, Mail, Phone, Save, Lock, Eye, EyeOff, Upload, X, Camera, Shield, Bell, History, Smartphone } from "lucide-react";

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();
  const { success, error: showError } = useToast();
  const { getThemeClasses } = useTheme();
  const theme = getThemeClasses();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Security settings state
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpMethods, setOtpMethods] = useState<('EMAIL' | 'SMS')[]>([]);
  const [loginNotificationsEmail, setLoginNotificationsEmail] = useState(true);
  const [loginNotificationsSMS, setLoginNotificationsSMS] = useState(true);
  const [newDeviceAlerts, setNewDeviceAlerts] = useState(true);
  const [savingSecurity, setSavingSecurity] = useState(false);

  useEffect(() => {
    if (session?.user) {
      fetchProfile();
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/profile", {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      console.log("Profile API response status:", response.status, response.statusText);

      if (!response.ok) {
        let errorData: any = {};
        try {
          const text = await response.text();
          console.error("Profile API error response text:", text);
          errorData = text ? JSON.parse(text) : {};
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
        }
        console.error("Profile API error data:", errorData);
        const errorMessage = errorData.error || `Failed to fetch profile (${response.status} ${response.statusText})`;
        console.error("Error message:", errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Profile API success, data:", data);
      
      if (data.user) {
        setName(data.user.name || "");
        setPhone(data.user.phone || "");
        setEmail(data.user.email || "");
        setImage(data.user.image || null);
        // Security settings - handle cases where fields might not exist
        setOtpEnabled(data.user.otpEnabled ?? false);
        // Handle both old otpMethod and new otpMethods
        if (data.user.otpMethods && Array.isArray(data.user.otpMethods)) {
          setOtpMethods(data.user.otpMethods);
        } else if (data.user.otpMethod) {
          // Migrate from old single method to new array
          setOtpMethods([data.user.otpMethod]);
        } else {
          setOtpMethods([]);
        }
        setLoginNotificationsEmail(data.user.loginNotificationsEmail ?? true);
        setLoginNotificationsSMS(data.user.loginNotificationsSMS ?? true);
        setNewDeviceAlerts(data.user.newDeviceAlerts ?? true);
      } else {
        console.warn("Profile API returned no user data:", data);
        showError("No user data received");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      showError(error instanceof Error ? error.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploadingImage(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'profiles');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      setImage(data.url);
      setImageFile(file);
      success('Profile picture uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      showError('Failed to upload profile picture');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImageFile(null);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      
      // If there's a new image file, upload it first
      let imageUrl = image;
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('folder', 'profiles');

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload profile picture');
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.url;
      }

      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          image: imageUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      success("Profile updated successfully!");
      // Update session to reflect changes
      await updateSession();
      setImageFile(null); // Clear the file after successful save
    } catch (error) {
      console.error("Error updating profile:", error);
      showError(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showError("New passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      showError("Password must be at least 6 characters long");
      return;
    }

    try {
      setChangingPassword(true);
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to change password");
      }

      success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error changing password:", error);
      showError(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdateSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otpEnabled && otpMethods.length === 0) {
      showError("Please select at least one 2FA method (Email or SMS)");
      return;
    }

    if (otpMethods.includes('SMS') && !phone) {
      showError("Please add a phone number to use SMS 2FA");
      return;
    }

    try {
      setSavingSecurity(true);
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          otpEnabled,
          otpMethods: otpEnabled ? otpMethods : [],
          loginNotificationsEmail,
          loginNotificationsSMS,
          newDeviceAlerts,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update security settings");
      }

      success("Security settings updated successfully!");
    } catch (error) {
      console.error("Error updating security settings:", error);
      showError(error instanceof Error ? error.message : "Failed to update security settings");
    } finally {
      setSavingSecurity(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your personal information and account settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Settings - Full Width on Mobile, First Column on Desktop */}
        <Card className={theme.card}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateSecurity} id="security-form" className="space-y-6">
              {/* Two-Factor Authentication */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication (2FA)</h3>
                    <p className="text-xs text-gray-500 mt-1">Add an extra layer of security to your account</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={otpEnabled}
                      onChange={(e) => {
                        setOtpEnabled(e.target.checked);
                        if (!e.target.checked) {
                          setOtpMethods([]);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {otpEnabled && (
                  <div className="ml-0 space-y-3 pl-4 border-l-2 border-blue-200">
                    <p className="text-xs text-gray-600">Choose how you want to receive verification codes (you can select both):</p>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={otpMethods.includes('EMAIL')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOtpMethods([...otpMethods, 'EMAIL']);
                            } else {
                              setOtpMethods(otpMethods.filter(m => m !== 'EMAIL'));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                        />
                        <div className="flex items-center space-x-2">
                          <Mail className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">Email ({email})</span>
                        </div>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={otpMethods.includes('SMS')}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setOtpMethods([...otpMethods, 'SMS']);
                            } else {
                              setOtpMethods(otpMethods.filter(m => m !== 'SMS'));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 focus:ring-blue-500 rounded"
                          disabled={!phone}
                        />
                        <div className="flex items-center space-x-2">
                          <Smartphone className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            SMS {phone ? `(${phone})` : '(Phone number required)'}
                          </span>
                        </div>
                      </label>
                      {!phone && (
                        <p className="text-xs text-red-600 ml-7">Please add a phone number in your profile to use SMS 2FA</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4"></div>

              {/* Login Notifications */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 flex items-center">
                  <Bell className="h-4 w-4 mr-2" />
                  Login Notifications
                </h3>
                <p className="text-xs text-gray-500">Get notified when someone logs into your account</p>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700">Email Notifications</label>
                      <p className="text-xs text-gray-500">Receive email alerts on login</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loginNotificationsEmail}
                        onChange={(e) => setLoginNotificationsEmail(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700">SMS Notifications</label>
                      <p className="text-xs text-gray-500">Receive SMS alerts on login</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={loginNotificationsSMS}
                        onChange={(e) => setLoginNotificationsSMS(e.target.checked)}
                        className="sr-only peer"
                        disabled={!phone}
                      />
                      <div className={`w-11 h-6 rounded-full peer ${!phone ? 'bg-gray-100' : 'bg-gray-200 peer-checked:bg-blue-600'} peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${!phone ? 'opacity-50' : ''}`}></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm text-gray-700">New Device Alerts</label>
                      <p className="text-xs text-gray-500">Alert when logging in from a new device or location</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newDeviceAlerts}
                        onChange={(e) => setNewDeviceAlerts(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4"></div>

              {/* Login History Link */}
              <div>
                <button
                  type="button"
                  onClick={() => window.location.href = '/settings/profile/security'}
                  className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  <History className="h-4 w-4" />
                  <span>View Login History</span>
                </button>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              form="security-form"
              variant="default"
              disabled={savingSecurity || (otpEnabled && otpMethods.length === 0)}
              className="w-full"
            >
              {savingSecurity ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Security Settings
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        {/* Profile Information */}
        <Card className={theme.card}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdateProfile} id="profile-form" className="space-y-4">
              {/* Profile Picture Upload */}
              <div>
                <label className="block text-sm font-medium mb-2">Profile Picture</label>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    {image ? (
                      <div className="relative">
                        <img
                          src={image}
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300">
                        <User className="h-12 w-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(file);
                          }
                        }}
                        disabled={isUploadingImage}
                      />
                      <div className={`flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors ${isUploadingImage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        {isUploadingImage ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            <span className="text-sm text-gray-600">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 text-gray-600" />
                            <span className="text-sm text-gray-600">
                              {image ? 'Change Picture' : 'Upload Picture'}
                            </span>
                          </>
                        )}
                      </div>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF. Max size 10MB</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={theme.input}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={theme.input}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 flex items-center">
                  <Phone className="h-4 w-4 mr-1" />
                  Phone
                </label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={theme.input}
                />
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              form="profile-form"
              variant="default"
              disabled={saving}
              className="w-full"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Change Password */}
        <Card className={theme.card}>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Lock className="h-5 w-5 mr-2" />
              Change Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} id="password-form" className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Current Password</label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className={theme.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">New Password</label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className={theme.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Confirm New Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={theme.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              form="password-form"
              variant="default"
              disabled={changingPassword}
              className="w-full"
            >
              {changingPassword ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Changing...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

