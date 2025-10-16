import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const form = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    setSubmittedEmail(data.email);
    setIsSubmitted(true);
    toast({
      title: "Reset link sent!",
      description: "Check your email for password reset instructions.",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-bold">Reset Password</CardTitle>
          <CardDescription className="text-base">
            {isSubmitted
              ? "We've sent you a reset link"
              : "Enter your email to receive a reset link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSubmitted ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full" data-testid="button-reset-password">
                  Send Reset Link
                </Button>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to <span className="font-medium text-foreground">{submittedEmail}</span>.
                Please check your inbox and follow the instructions.
              </p>
              <Link href="/login">
                <a data-testid="link-back-login">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Login
                  </Button>
                </a>
              </Link>
            </div>
          )}
          
          {!isSubmitted && (
            <div className="mt-6 text-center">
              <Link href="/login">
                <a className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2" data-testid="link-back-login-alt">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </a>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
