import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, CheckCircle, Users } from "lucide-react";
import { Link } from "wouter";
import avatar1 from "@assets/generated_images/Female_professional_avatar_4d4900f0.png";
import avatar2 from "@assets/generated_images/Male_professional_avatar_492df590.png";
import avatar3 from "@assets/generated_images/Experienced_professional_avatar_13ef1d1a.png";

export default function DashboardHome() {
  const stats = [
    { label: "Active Matches", value: "8", icon: Users, color: "text-chart-1" },
    { label: "Pending Requests", value: "3", icon: Clock, color: "text-chart-2" },
    { label: "Completed Exchanges", value: "12", icon: CheckCircle, color: "text-chart-3" },
    { label: "Your Rating", value: "4.8", icon: Star, color: "text-chart-4" },
  ];

  const latestMatches = [
    {
      id: "1",
      name: "Sarah Chen",
      avatar: avatar1,
      skill: "Web Development",
      wantsToLearn: "Graphic Design",
      rating: 4.9,
      matchScore: 95,
    },
    {
      id: "2",
      name: "Michael Ross",
      avatar: avatar2,
      skill: "Photography",
      wantsToLearn: "Video Editing",
      rating: 4.7,
      matchScore: 88,
    },
    {
      id: "3",
      name: "Emily Davis",
      avatar: avatar3,
      skill: "Content Writing",
      wantsToLearn: "Social Media Marketing",
      rating: 5.0,
      matchScore: 92,
    },
  ];

  const pendingRequests = [
    {
      id: "1",
      from: "James Wilson",
      skill: "Spanish Language",
      status: "pending",
      time: "2 hours ago",
    },
    {
      id: "2",
      from: "Lisa Anderson",
      skill: "Yoga Instruction",
      status: "pending",
      time: "5 hours ago",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Welcome back, Alex!</h1>
        <p className="text-muted-foreground text-lg">
          Here's what's happening with your skill exchanges
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} data-testid={`stat-${stat.label.toLowerCase().replace(/\s+/g, '-')}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                  <span className="text-3xl font-bold">{stat.value}</span>
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl">Latest Matches</CardTitle>
              <CardDescription>People who match your skills and interests</CardDescription>
            </div>
            <Link href="/dashboard/discover">
              <a data-testid="link-view-all-matches">
                <Button variant="outline" size="sm">View All</Button>
              </a>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestMatches.map((match) => (
              <div
                key={match.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-card-border hover-elevate transition-all"
                data-testid={`match-card-${match.id}`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={match.avatar} />
                  <AvatarFallback>{match.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold truncate">{match.name}</p>
                    <div className="flex items-center gap-1 text-sm">
                      <Star className="h-3 w-3 fill-current" />
                      <span>{match.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Teaches: <span className="text-foreground font-medium">{match.skill}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Wants: <span className="text-foreground font-medium">{match.wantsToLearn}</span>
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {match.matchScore}% Match
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Pending Requests</CardTitle>
            <CardDescription>Skill exchange requests awaiting your response</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="p-4 rounded-lg border border-card-border space-y-3"
                data-testid={`request-${request.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1">{request.from}</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      Wants to learn <span className="text-foreground font-medium">{request.skill}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{request.time}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" data-testid={`button-accept-${request.id}`}>
                    Accept
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" data-testid={`button-decline-${request.id}`}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
            
            <Link href="/dashboard/discover">
              <a data-testid="link-find-more-matches">
                <Button variant="outline" className="w-full">
                  Find More Matches
                </Button>
              </a>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
