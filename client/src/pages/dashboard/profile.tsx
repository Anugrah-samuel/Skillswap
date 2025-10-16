import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Star, Mail, Edit, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import avatar1 from "@assets/generated_images/Female_professional_avatar_4d4900f0.png";

export default function Profile() {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [profile, setProfile] = useState({
    fullName: "Alex Morgan",
    username: "@alexmorgan",
    email: "alex.morgan@example.com",
    bio: "Passionate about technology and design. Love learning new skills and helping others grow. Currently focusing on web development and UI/UX design.",
    avatar: avatar1,
    rating: 4.8,
    totalReviews: 24,
    completedExchanges: 12,
  });

  const [editForm, setEditForm] = useState(profile);

  const handleSave = () => {
    setProfile(editForm);
    toast({ title: "Profile updated successfully" });
    setIsEditDialogOpen(false);
  };

  const skillsTeaching = [
    { name: "React Development", level: "Advanced" },
    { name: "Spanish Language", level: "Expert" },
    { name: "Guitar Playing", level: "Intermediate" },
  ];

  const skillsLearning = [
    { name: "UI/UX Design", level: "Intermediate" },
    { name: "Photography", level: "Beginner" },
    { name: "Content Writing", level: "Beginner" },
  ];

  const reviews = [
    {
      id: "1",
      reviewer: "Sarah Chen",
      rating: 5,
      comment: "Alex is an excellent teacher! Very patient and knowledgeable about React. Highly recommended!",
      date: "2 weeks ago",
    },
    {
      id: "2",
      reviewer: "Michael Ross",
      rating: 5,
      comment: "Great learning experience. Alex made complex concepts easy to understand.",
      date: "1 month ago",
    },
    {
      id: "3",
      reviewer: "Emily Davis",
      rating: 4,
      comment: "Very helpful and supportive. Looking forward to more sessions!",
      date: "1 month ago",
    },
  ];

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
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar} />
                  <AvatarFallback className="text-2xl">
                    {profile.fullName.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold mb-1">{profile.fullName}</h2>
                  <p className="text-muted-foreground mb-3">{profile.username}</p>
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < Math.floor(profile.rating) ? 'fill-current text-foreground' : 'text-muted'}`}
                        />
                      ))}
                      <span className="ml-2 font-semibold">{profile.rating}</span>
                      <span className="text-muted-foreground">({profile.totalReviews} reviews)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{profile.email}</span>
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
                  <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
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
                <p className="text-3xl font-bold mb-1">{profile.completedExchanges}</p>
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
