import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Star, Send, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

const categories = ["All", "Technology", "Design", "Business", "Languages", "Arts", "Fitness"];

interface MatchSuggestion {
  user: {
    id: string;
    fullName: string;
    bio?: string;
    avatarUrl?: string;
    rating: number;
    totalReviews: number;
  };
  teachingSkill: {
    id: string;
    title: string;
    description: string;
    category: string;
    level: string;
    availability?: string;
  };
  learningSkill: {
    id: string;
    title: string;
    description: string;
    category: string;
    level: string;
    type: string;
  };
  matchScore: number;
}

export default function Discover() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [selectedMatch, setSelectedMatch] = useState<MatchSuggestion | null>(null);

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
        description: "Please log in to discover skills",
        variant: "destructive",
      });
      setLocation("/login");
    }
  }, [userId, setLocation, toast]);

  const { data: suggestions = [], isLoading, isError, error, refetch } = useQuery<MatchSuggestion[]>({
    queryKey: ["/api/matches/suggestions", userId],
    queryFn: async () => {
      if (!userId) throw new Error("User not authenticated");
      const response = await apiRequest("GET", `/api/matches/suggestions/${userId}`);
      return response.json();
    },
    enabled: !!userId, // Only run query if userId exists
  });

  const requestTradeMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/matches/request", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matches/suggestions", userId] });
      toast({
        title: "Request sent!",
        description: `Your skill trade request has been sent.`,
      });
      setSelectedMatch(null);
    },
    onError: (error: Error) => {
      console.error('Skill trade request error:', error);
      toast({
        title: "Failed to send request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredMatches = suggestions.filter(match => {
    const matchesSearch = match.user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      match.teachingSkill.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "All" || match.teachingSkill.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleRequestTrade = () => {
    if (!selectedMatch) return;
    
    const requestData = {
      userId,
      matchedUserId: selectedMatch.user.id,
      userSkillId: selectedMatch.learningSkill.id,
      matchedSkillId: selectedMatch.teachingSkill.id,
      status: "pending",
    };
    
    console.log('Sending skill trade request:', requestData);
    requestTradeMutation.mutate(requestData);
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

      {isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Finding matches...</p>
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-destructive mb-4">Failed to load matches: {error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button onClick={() => refetch()} variant="outline" data-testid="button-retry-matches">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : filteredMatches.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">No matches found. Try adjusting your filters or add more skills to your profile.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match, idx) => {
            const rating = (match.user.rating || 0) / 10;
            return (
              <Card key={idx} className="hover-elevate transition-all" data-testid={`match-card-${idx}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-4 mb-3">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={match.user.avatarUrl} />
                      <AvatarFallback>{match.user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl mb-1">{match.user.fullName}</CardTitle>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${i < Math.floor(rating) ? 'fill-current' : 'text-muted'}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {rating.toFixed(1)} ({match.user.totalReviews || 0})
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {match.matchScore}% Match
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">{match.user.bio || "No bio available"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Can Teach:</p>
                    <p className="text-sm text-foreground font-semibold mb-1">{match.teachingSkill.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{match.teachingSkill.description}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Wants to Learn:</p>
                    <p className="text-sm text-foreground font-semibold">{match.learningSkill.title}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{match.teachingSkill.category}</Badge>
                    <Badge variant="outline">{match.teachingSkill.level}</Badge>
                    {match.teachingSkill.availability && (
                      <Badge variant="outline">{match.teachingSkill.availability}</Badge>
                    )}
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setSelectedMatch(match)}
                    data-testid={`button-request-trade-${idx}`}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Request Trade
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedMatch} onOpenChange={() => setSelectedMatch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Skill Trade</DialogTitle>
            <DialogDescription>
              Send a skill exchange request to {selectedMatch?.user.fullName}
            </DialogDescription>
          </DialogHeader>
          {selectedMatch && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedMatch.user.avatarUrl} />
                  <AvatarFallback>{selectedMatch.user.fullName?.split(' ').map((n: string) => n[0]).join('') || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{selectedMatch.user.fullName}</p>
                  <p className="text-sm text-muted-foreground">Teaches {selectedMatch.teachingSkill.title}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">You will teach:</span>{" "}
                  <span className="text-muted-foreground">{selectedMatch.learningSkill.title}</span>
                </p>
                <p>
                  <span className="font-medium">You will learn:</span>{" "}
                  <span className="text-muted-foreground">{selectedMatch.teachingSkill.title}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMatch(null)} data-testid="button-cancel-request">
              Cancel
            </Button>
            <Button 
              onClick={handleRequestTrade} 
              disabled={requestTradeMutation.isPending}
              data-testid="button-confirm-request"
            >
              {requestTradeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
