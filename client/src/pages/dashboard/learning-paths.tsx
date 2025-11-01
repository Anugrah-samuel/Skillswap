import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BookOpen, Clock, Target, CheckCircle, Play, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function LearningPaths() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Learning paths will be loaded from API
  const learningPaths: any[] = [];

  const handleCreatePath = () => {
    toast({ title: "Learning path created successfully" });
    setIsCreateDialogOpen(false);
  };

  const filteredPaths = learningPaths.filter(path => 
    path.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    path.skill.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold mb-2">Learning Paths</h1>
          <p className="text-muted-foreground text-lg">
            AI-powered roadmaps to master your chosen skills
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Path
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search learning paths..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredPaths.map((path) => (
          <Card key={path.id} className="hover-elevate transition-all">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {path.title}
                  </CardTitle>
                  <CardDescription className="mt-2">{path.description}</CardDescription>
                </div>
                <Badge variant="secondary">{path.skill}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span>{path.estimatedTime}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>{path.progress}% complete</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{path.progress}%</span>
                </div>
                <Progress value={path.progress} />
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Topics</h3>
                <div className="space-y-2">
                  {path.topics.slice(0, 3).map((topic) => (
                    <div key={topic.id} className="flex items-center gap-2">
                      {topic.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-muted-foreground"></div>
                      )}
                      <span className={topic.completed ? "line-through text-muted-foreground" : ""}>
                        {topic.title}
                      </span>
                    </div>
                  ))}
                  {path.topics.length > 3 && (
                    <Button variant="link" className="px-0 h-auto text-sm">
                      + {path.topics.length - 3} more topics
                    </Button>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Resources</h3>
                <div className="space-y-2">
                  {path.resources.map((resource) => (
                    <div key={resource.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <span className="text-sm">{resource.title}</span>
                      <Badge variant="outline" className="text-xs">
                        {resource.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Continue Learning
                </Button>
                <Button variant="outline">View Details</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Learning Path</DialogTitle>
            <DialogDescription>
              Let our AI create a personalized roadmap for mastering a new skill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skill">Skill to Learn</Label>
              <Input
                id="skill"
                placeholder="Skill to Learn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal">Learning Goal</Label>
              <Textarea
                id="goal"
                placeholder="Learning Goals"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeline">Timeline</Label>
              <Input
                id="timeline"
                placeholder="Timeline"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience">Current Experience Level</Label>
              <select className="w-full p-2 border rounded-lg bg-background">
                <option>Beginner (No experience)</option>
                <option>Intermediate (Some experience)</option>
                <option>Advanced (Extensive experience)</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePath}>
              Generate Learning Path
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}