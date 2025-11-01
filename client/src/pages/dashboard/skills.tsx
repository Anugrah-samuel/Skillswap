import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Edit, Trash2, Search, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSkillSchema, type Skill } from "@shared/schema";

const categories = ["Technology", "Design", "Business", "Languages", "Arts", "Fitness", "Music", "Cooking"];
const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];
const types = ["Teaching", "Learning"];

export default function Skills() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");

  // Get user ID from localStorage (stored during login)
  const getUserId = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user).id : null;
  };
  
  const userId = getUserId();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userId) {
      toast({
        title: "Authentication required",
        description: "Please log in to manage your skills",
        variant: "destructive",
      });
      setLocation("/login");
    }
  }, [userId, setLocation, toast]);

  const form = useForm({
    resolver: zodResolver(insertSkillSchema.extend({
      userId: insertSkillSchema.shape.userId.optional(),
    })),
    defaultValues: {
      userId,
      title: "",
      description: "",
      category: "",
      level: "",
      type: "",
      availability: "",
    },
  });

  const { data: skills = [], isLoading, isError, error, refetch } = useQuery<Skill[]>({
    queryKey: ["/api/skills", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      const response = await apiRequest("GET", `/api/skills?userId=${userId}`);
      return response.json();
    },
    enabled: !!userId, // Only run query if userId exists
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/skills", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", userId] });
      toast({ title: "Skill added successfully" });
      setIsDialogOpen(false);
      form.reset({ userId, title: "", description: "", category: "", level: "", type: "", availability: "" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to add skill", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const response = await apiRequest("PUT", `/api/skills/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", userId] });
      toast({ title: "Skill updated successfully" });
      setIsDialogOpen(false);
      setEditingSkill(null);
      form.reset({ userId, title: "", description: "", category: "", level: "", type: "", availability: "" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to update skill", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/skills/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/skills", userId] });
      toast({ title: "Skill deleted" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Failed to delete skill", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const openDialog = (skill?: Skill) => {
    if (skill) {
      setEditingSkill(skill);
      form.reset({
        userId: skill.userId,
        title: skill.title,
        description: skill.description,
        category: skill.category,
        level: skill.level,
        type: skill.type,
        availability: skill.availability || "",
      });
    } else {
      setEditingSkill(null);
      form.reset({ userId, title: "", description: "", category: "", level: "", type: "", availability: "" });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    if (editingSkill) {
      updateMutation.mutate({ id: editingSkill.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || skill.category === filterCategory;
    const matchesType = filterType === "all" || skill.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-4xl font-bold mb-2">My Skills</h1>
          <p className="text-muted-foreground text-lg">
            Manage the skills you can teach and want to learn
          </p>
        </div>
        <Button onClick={() => openDialog()} data-testid="button-add-skill">
          <Plus className="h-4 w-4 mr-2" />
          Add Skill
        </Button>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search skills..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-skills"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-filter-type">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="Teaching">Teaching</SelectItem>
                <SelectItem value="Learning">Learning</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading skills...</p>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive mb-4">Failed to load skills: {error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-retry-skills">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredSkills.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground mb-4">No skills found. Add your first skill to get started!</p>
            <Button onClick={() => openDialog()} data-testid="button-add-first-skill">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Skill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSkills.map((skill) => (
            <Card key={skill.id} className="hover-elevate transition-all" data-testid={`skill-card-${skill.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <CardTitle className="text-xl">{skill.title}</CardTitle>
                  <Badge variant={skill.type === "Teaching" ? "default" : "secondary"}>
                    {skill.type}
                  </Badge>
                </div>
                <CardDescription>{skill.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{skill.category}</Badge>
                  <Badge variant="outline">{skill.level}</Badge>
                  {skill.availability && (
                    <Badge variant="outline">{skill.availability}</Badge>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openDialog(skill)}
                    data-testid={`button-edit-${skill.id}`}
                  >
                    <Edit className="h-3 w-3 mr-2" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(skill.id)}
                    data-testid={`button-delete-${skill.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingSkill ? "Edit Skill" : "Add New Skill"}</DialogTitle>
            <DialogDescription>
              {editingSkill ? "Update the details of your skill" : "Add a skill you can teach or want to learn"}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Skill Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Skill Title"
                        {...field}
                        data-testid="input-skill-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Skill Description"
                        rows={4}
                        {...field}
                        data-testid="input-skill-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-skill-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="level"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Level</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-skill-level">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {levels.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-skill-type">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {types.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="availability"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Availability</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Availability"
                          {...field}
                          data-testid="input-skill-availability"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-skill">
                  {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSkill ? "Update Skill" : "Add Skill"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
