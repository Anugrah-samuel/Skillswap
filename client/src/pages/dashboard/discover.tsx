import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Star, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import avatar1 from "@assets/generated_images/Female_professional_avatar_4d4900f0.png";
import avatar2 from "@assets/generated_images/Male_professional_avatar_492df590.png";
import avatar3 from "@assets/generated_images/Experienced_professional_avatar_13ef1d1a.png";

const categories = ["All", "Technology", "Design", "Business", "Languages", "Arts", "Fitness"];

export default function Discover() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedMatch, setSelectedMatch] = useState<any>(null);

  const matches = [
    {
      id: "1",
      name: "Sarah Chen",
      avatar: avatar1,
      bio: "Full-stack developer passionate about teaching web development",
      skill: "Web Development",
      skillDescription: "React, Node.js, TypeScript, and modern web technologies",
      wantsToLearn: "Graphic Design",
      category: "Technology",
      level: "Advanced",
      rating: 4.9,
      totalReviews: 24,
      matchScore: 95,
      availability: "Weekends",
    },
    {
      id: "2",
      name: "Michael Ross",
      avatar: avatar2,
      bio: "Professional photographer with 10 years of experience",
      skill: "Photography",
      skillDescription: "Portrait, landscape, and product photography techniques",
      wantsToLearn: "Video Editing",
      category: "Arts",
      level: "Expert",
      rating: 4.7,
      totalReviews: 18,
      matchScore: 88,
      availability: "Evenings",
    },
    {
      id: "3",
      name: "Emily Davis",
      avatar: avatar3,
      bio: "Content strategist and creative writer",
      skill: "Content Writing",
      skillDescription: "Blog posts, copywriting, and content strategy",
      wantsToLearn: "Social Media Marketing",
      category: "Business",
      level: "Intermediate",
      rating: 5.0,
      totalReviews: 31,
      matchScore: 92,
      availability: "Flexible",
    },
    {
      id: "4",
      name: "Carlos Rodriguez",
      avatar: avatar2,
      bio: "Native Spanish speaker and certified language instructor",
      skill: "Spanish Language",
      skillDescription: "Conversational Spanish, grammar, and cultural insights",
      wantsToLearn: "English Language",
      category: "Languages",
      level: "Expert",
      rating: 4.8,
      totalReviews: 42,
      matchScore: 85,
      availability: "Mornings",
    },
  ];

  const filteredMatches = matches.filter(match => {
    const matchesSearch = match.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.skill.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || match.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRequestTrade = () => {
    toast({
      title: "Request sent!",
      description: `Your skill trade request has been sent to ${selectedMatch.name}.`,
    });
    setSelectedMatch(null);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Discover Skills</h1>
        <p className="text-muted-foreground text-lg">
          Find the perfect skill exchange partners
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or skill..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-matches"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full md:w-48" data-testid="select-filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMatches.map((match) => (
          <Card key={match.id} className="hover-elevate transition-all" data-testid={`match-card-${match.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4 mb-3">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={match.avatar} />
                  <AvatarFallback>{match.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl mb-1">{match.name}</CardTitle>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < Math.floor(match.rating) ? 'fill-current' : 'text-muted'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {match.rating} ({match.totalReviews})
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {match.matchScore}% Match
                  </Badge>
                </div>
              </div>
              <CardDescription className="line-clamp-2">{match.bio}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Can Teach:</p>
                <p className="text-sm text-foreground font-semibold mb-1">{match.skill}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{match.skillDescription}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Wants to Learn:</p>
                <p className="text-sm text-foreground font-semibold">{match.wantsToLearn}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{match.category}</Badge>
                <Badge variant="outline">{match.level}</Badge>
                <Badge variant="outline">{match.availability}</Badge>
              </div>
              <Button
                className="w-full"
                onClick={() => setSelectedMatch(match)}
                data-testid={`button-request-trade-${match.id}`}
              >
                <Send className="h-4 w-4 mr-2" />
                Request Trade
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Skill Trade</DialogTitle>
            <DialogDescription>
              Send a skill exchange request to {selectedMatch?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedMatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedMatch.avatar} />
                  <AvatarFallback>{selectedMatch.name.split(' ').map((n: string) => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{selectedMatch.name}</p>
                  <p className="text-sm text-muted-foreground">Teaches {selectedMatch.skill}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">You will teach:</span>{" "}
                  <span className="text-muted-foreground">{selectedMatch.wantsToLearn}</span>
                </p>
                <p>
                  <span className="font-medium">You will learn:</span>{" "}
                  <span className="text-muted-foreground">{selectedMatch.skill}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)} data-testid="button-cancel-request">
              Cancel
            </Button>
            <Button onClick={handleRequestTrade} data-testid="button-confirm-request">
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
