import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useActivateCode } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";

const formSchema = z.object({
  code: z.string().min(1, "Activation code is required"),
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
});

export default function Activation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { deviceId, setSession } = useUserSession();
  const activateCode = useActivateCode();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      code: "",
      fullName: "",
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!deviceId) return;
    
    activateCode.mutate(
      {
        data: {
          code: values.code,
          deviceId: deviceId,
          fullName: values.fullName,
          email: values.email,
        },
      },
      {
        onSuccess: (res) => {
          setSession({
            activationCode: values.code,
            fullName: values.fullName,
            email: values.email,
          });
          
          if (res.waiverRequired) {
            setLocation("/waiver");
          } else {
            setLocation("/training");
          }
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Activation Failed",
            description: err.response?.data?.error || "Invalid code or device bond.",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black font-mono tracking-tighter text-primary uppercase">Chainsaw Manual</h1>
          <p className="text-muted-foreground uppercase tracking-widest text-xs mt-2 font-mono">Professional Training Portal</p>
        </div>
        
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader className="space-y-1 text-center border-b border-border mb-6 pb-6">
            <CardTitle className="text-2xl font-mono uppercase tracking-wide">System Activation</CardTitle>
            <CardDescription className="font-mono text-xs">
              Enter your access credentials to unlock the training modules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-xs text-muted-foreground tracking-wider">Purchase Code</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g. CHT-XYZ-123" 
                          {...field} 
                          className="font-mono bg-secondary/50 border-input h-12 uppercase" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-xs text-muted-foreground tracking-wider">Full Legal Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe" 
                          {...field} 
                          className="bg-secondary/50 border-input h-12" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono uppercase text-xs text-muted-foreground tracking-wider">Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="john@example.com" 
                          type="email"
                          {...field} 
                          className="bg-secondary/50 border-input h-12" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-14 font-mono font-bold tracking-widest text-sm"
                  disabled={activateCode.isPending}
                >
                  {activateCode.isPending ? "ACTIVATING..." : "ACTIVATE"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-xs text-muted-foreground font-mono opacity-50">
          <p>DEVICE ID: {deviceId || "INITIALIZING..."}</p>
          <p className="mt-1">AUTHORIZATION REQUIRED</p>
        </div>
      </div>
    </div>
  );
}
