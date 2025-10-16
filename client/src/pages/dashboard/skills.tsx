import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const categories = ["Technology", "Design", "Business", "Languages", "Arts", "Fitness", "Music", "Cooking"];
const levels = ["Beginner", "Intermediate", "Advanced", "Expert"];
const types = ["Teaching", "Learning"];

export default function Skills() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    level: "",
    type: "",
    availability: "",
  });

  const [skills, setSkills] = useState([
    {
      id: "1",
      title: "React Development",
      description: "Building modern web applications with React, TypeScript, and modern tooling",
      category: "Technology",
      level: "Advanced",
      type: "Teaching",
      availability: "Weekends",
    },
    {
      id: "2",
      title: "UI/UX Design",
      description: "User interface design, prototyping, and user experience principles",
      category: "Design",
      level: "Intermediate",
      type: "Learning",
      availability: "Evenings",
    },
    {
      id: "3",
      title: "Spanish Language",
      description: "Conversational Spanish and basic grammar for beginners",
      category: "Languages",
      level: "Expert",
      type: "Teaching",
      availability: "Flexible",
    },
  ]);

  const openDialog = (skill?: any) => {
    if (skill) {
      setEditingSkill(skill);
      setFormData(skill);
    } else {
      setEditingSkill(null);
      setFormData({
        title: "",
        description: "",
        category: "",
        level: "",
        type: "",
        availability: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingSkill) {
      setSkills(skills.map(s => s.id === editingSkill.id ? { ...formData, id: editingSkill.id } : s));
      toast({ title: "Skill updated successfully" });
    } else {
      setSkills([...skills, { ...formData, id: Date.now().toString() }]);
      toast({ title: "Skill added successfully" });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setSkills(skills.filter(s => s.id !== id));
    toast({ title: "Skill deleted" });
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

      {filteredSkills.length === 0 ? (
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Skill Title</Label>
              <Input
                id="title"
                placeholder="e.g., Web Development, Guitar Playing"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                data-testid="input-skill-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Describe what you can teach or what you want to learn..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                data-testid="input-skill-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger data-testid="select-skill-category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="level">Level</Label>
                <Select value={formData.level} onValueChange={(value) => setFormData({ ...formData, level: value })}>
                  <SelectTrigger data-testid="select-skill-level">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map(level => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger data-testid="select-skill-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {types.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="availability">Availability</Label>
                <Input
                  id="availability"
                  placeholder="e.g., Weekends, Evenings"
                  value={formData.availability}
                  onChange={(e) => setFormData({ ...formData, availability: e.target.value })}
                  data-testid="input-skill-availability"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSave} data-testid="button-save-skill">
              {editingSkill ? "Update Skill" : "Add Skill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
