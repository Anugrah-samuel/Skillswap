import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";

export default function Settings() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notifications, setNotifications] = useState({
    emailMatches: true,
    emailMessages: true,
    emailReminders: true,
    pushNotifications: false,
  });

  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showEmail: false,
    showRating: true,
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your new passwords match.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Password updated",
      description: "Your password has been changed successfully.",
    });
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Preferences saved",
      description: "Your notification preferences have been updated.",
    });
  };

  const handleSavePrivacy = () => {
    toast({
      title: "Privacy settings updated",
      description: "Your privacy preferences have been saved.",
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground text-lg">
          Manage your account preferences and security
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showPassword ? "text" : "password"}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    required
                    data-testid="input-current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  data-testid="input-new-password"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  data-testid="input-confirm-password"
                />
              </div>
              
              <Button type="submit" data-testid="button-change-password">
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>Choose how you want to be notified</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailMatches">New Match Notifications</Label>
                <p className="text-sm text-muted-foreground">Get notified when you have new skill matches</p>
              </div>
              <Switch
                id="emailMatches"
                checked={notifications.emailMatches}
                onCheckedChange={(checked) => setNotifications({ ...notifications, emailMatches: checked })}
                data-testid="switch-email-matches"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailMessages">Message Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive emails for new messages</p>
              </div>
              <Switch
                id="emailMessages"
                checked={notifications.emailMessages}
                onCheckedChange={(checked) => setNotifications({ ...notifications, emailMessages: checked })}
                data-testid="switch-email-messages"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="emailReminders">Session Reminders</Label>
                <p className="text-sm text-muted-foreground">Get reminded about upcoming skill exchange sessions</p>
              </div>
              <Switch
                id="emailReminders"
                checked={notifications.emailReminders}
                onCheckedChange={(checked) => setNotifications({ ...notifications, emailReminders: checked })}
                data-testid="switch-email-reminders"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="pushNotifications">Push Notifications</Label>
                <p className="text-sm text-muted-foreground">Enable browser push notifications</p>
              </div>
              <Switch
                id="pushNotifications"
                checked={notifications.pushNotifications}
                onCheckedChange={(checked) => setNotifications({ ...notifications, pushNotifications: checked })}
                data-testid="switch-push-notifications"
              />
            </div>
            
            <Button onClick={handleSaveNotifications} data-testid="button-save-notifications">
              Save Preferences
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy Settings</CardTitle>
            <CardDescription>Control who can see your information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="profileVisible">Public Profile</Label>
                <p className="text-sm text-muted-foreground">Make your profile visible to other users</p>
              </div>
              <Switch
                id="profileVisible"
                checked={privacy.profileVisible}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, profileVisible: checked })}
                data-testid="switch-profile-visible"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showEmail">Show Email Address</Label>
                <p className="text-sm text-muted-foreground">Display your email on your public profile</p>
              </div>
              <Switch
                id="showEmail"
                checked={privacy.showEmail}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, showEmail: checked })}
                data-testid="switch-show-email"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="showRating">Show Rating</Label>
                <p className="text-sm text-muted-foreground">Display your rating and reviews publicly</p>
              </div>
              <Switch
                id="showRating"
                checked={privacy.showRating}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, showRating: checked })}
                data-testid="switch-show-rating"
              />
            </div>
            
            <Button onClick={handleSavePrivacy} data-testid="button-save-privacy">
              Save Privacy Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
