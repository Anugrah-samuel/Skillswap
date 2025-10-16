import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Sparkles, Calendar, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import heroImage from "@assets/generated_images/Hero_image_collaborative_learning_5cf8eca1.png";

export default function Landing() {
  const features = [
    {
      icon: Users,
      title: "Connect with Learners",
      description: "Find people eager to learn what you can teach and discover mentors for skills you want to master.",
    },
    {
      icon: Sparkles,
      title: "Smart Matching",
      description: "Our intelligent algorithm connects you with the perfect skill exchange partners based on your interests.",
    },
    {
      icon: Calendar,
      title: "Easy Scheduling",
      description: "Coordinate sessions effortlessly with integrated calendar and scheduling tools.",
    },
    {
      icon: Shield,
      title: "Trusted Community",
      description: "Build trust through ratings, reviews, and verified skill exchanges with our community members.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <a className="text-2xl font-bold tracking-tight hover-elevate active-elevate-2 px-4 py-2 rounded-lg" data-testid="link-home">
              SkillSwap
            </a>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/login">
              <a data-testid="link-login-header">
                <Button variant="ghost" className="hover-elevate active-elevate-2">
                  Log In
                </Button>
              </a>
            </Link>
            <Link href="/signup">
              <a data-testid="link-signup-header">
                <Button variant="default">Sign Up</Button>
              </a>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background z-10"></div>
          <img
            src={heroImage}
            alt="People collaborating and learning together"
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        
        <div className="container mx-auto px-6 py-24 relative z-20 text-center">
          <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 tracking-tight leading-tight">
            Exchange Skills,
            <br />
            <span className="text-muted-foreground">Build Community</span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed">
            Connect with others to learn new skills and share your expertise.
            Join a vibrant community of lifelong learners and skilled mentors.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/signup">
              <a data-testid="link-signup-hero">
                <Button size="lg" className="text-lg px-8 py-6 h-auto min-h-12">
                  Get Started
                </Button>
              </a>
            </Link>
            <Link href="/login">
              <a data-testid="link-login-hero">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto min-h-12 bg-background/50 backdrop-blur">
                  Sign In
                </Button>
              </a>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
              How SkillSwap Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A simple, effective way to grow your skills and help others grow theirs
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="hover-elevate transition-all duration-200" data-testid={`card-feature-${index}`}>
                  <CardContent className="p-8">
                    <div className="w-16 h-16 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            Ready to Start Learning?
          </h2>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Join thousands of members already exchanging skills and building connections
          </p>
          <Link href="/signup">
            <a data-testid="link-signup-cta">
              <Button size="lg" className="text-lg px-8 py-6 h-auto min-h-12">
                Join SkillSwap Today
              </Button>
            </a>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-12 bg-card">
        <div className="container mx-auto px-6 text-center text-muted-foreground">
          <p className="mb-2 font-medium">SkillSwap</p>
          <p className="text-sm">Exchange skills, build community, grow together.</p>
        </div>
      </footer>
    </div>
  );
}
