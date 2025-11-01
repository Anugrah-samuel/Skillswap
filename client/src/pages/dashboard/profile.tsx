import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Mail, Edit, Award, Camera, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Profile() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    username: "",
    email: "",
    bio: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get user ID from localStorage
  const getUserId = () => {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user).id : null;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return null;
    }
  };
  
  const userId = getUserId();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to view your profile",
        variant: "destructive",
      });
      setLocation("/login");
      return;
    }
  }, [userId, setLocation, toast]);

  // Fetch user profile data
  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ["/api/profile", userId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/profile/${userId}`);
      return response.json();
    },
    enabled: !!userId,
  });

  // Update edit form when profile data loads
  useEffect(() => {
    if (profile) {
      setEditForm({
        fullName: profile.fullName || "",
        username: profile.username || "",
        email: profile.email || "",
        bio: profile.bio || "",
      });
    }
  }, [profile]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/profile`, data);
      return response.json();
    },
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile", userId] });
      
      // Update localStorage with new user data
      try {
        const currentUser = localStorage.getItem('user');
        if (currentUser) {
          const userData = JSON.parse(currentUser);
          const newUserData = { ...userData, ...updatedUser };
          localStorage.setItem('user', JSON.stringify(newUserData));
          // Trigger storage event for sidebar update
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'user',
            newValue: JSON.stringify(newUserData),
          }));
        }
      } catch (error) {
        console.error('Error updating localStorage:', error);
      }
      
      toast({ title: "Profile updated successfully" });
      setIsEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload profile picture mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'avatar');
      
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload image: ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update user's avatar URL
      const updatedProfile = {
        ...editForm,
        avatarUrl: data.url,
      };
      updateProfileMutation.mutate(updatedProfile);
      toast({
        title: "Profile picture updated!",
        description: "Your profile picture has been uploaded successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload image",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate(editForm);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    uploadAvatarMutation.mutate(file);
  };

  const skillsTeaching: any[] = [];
  const skillsLearning: any[] = [];
  const reviews: any[] = [];

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Error loading profile: {profileError.message}</p>
        <Button 
          onClick={() => setLocation("/login")} 
          className="mt-4"
        >
          Go to Login
        </Button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Unable to load profile data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground text-lg">
          Manage your public profile and reputation
        </p>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex items-start gap-6">
                <div className="relative">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatarUrl || profile.avatar} alt="Profile picture" />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {profile.fullName?.split(' ').map((n: string) => n[0]).join('') || profile.username?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAvatarMutation.isPending}
                  >
                    {uploadAvatarMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-1">{profile.fullName || 'No name set'}</h2>
                  <p className="text-muted-foreground mb-3">@{profile.username || 'username'}</p>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.floor(profile.rating || 0) ? 'fill-current text-foreground' : 'text-muted'}`}
                        />
                      ))}
                      <span className="ml-2 font-semibold">{profile.rating || 0}</span>
                      <span className="text-muted-foreground">({profile.totalReviews || 0} reviews)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{profile.email || 'No email set'}</span>
                  </div>
                </div>
              </div>
              <Button onClick={() => setIsEditDialogOpen(true)} data-testid="button-edit-profile">
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">About</h3>
                  <p className="text-muted-foreground leading-relaxed">{profile.bio || 'No bio added yet.'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reviews & Ratings</CardTitle>
              <CardDescription>What others say about learning from you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="pb-4 border-b border-card-border last:border-0 last:pb-0" data-testid={`review-${review.id}`}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div>
                      <p className="font-semibold">{review.reviewer}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < review.rating ? 'fill-current' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">{review.date}</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-3xl font-bold mb-1">{profile.completedExchanges || 0}</p>
                <p className="text-sm text-muted-foreground">Completed Exchanges</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">{skillsTeaching.length}</p>
                <p className="text-sm text-muted-foreground">Skills Teaching</p>
              </div>
              <div>
                <p className="text-3xl font-bold mb-1">{skillsLearning.length}</p>
                <p className="text-sm text-muted-foreground">Skills Learning</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills I Teach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {skillsTeaching.map((skill, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">{skill.name}</span>
                  <Badge variant="outline" className="text-xs">{skill.level}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Skills I'm Learning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {skillsLearning.map((skill, index) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">{skill.name}</span>
                  <Badge variant="outline" className="text-xs">{skill.level}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>Update your profile information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={editForm.fullName}
                onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                data-testid="input-fullname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={editForm.bio}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                rows={4}
                data-testid="input-bio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-profile">
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
