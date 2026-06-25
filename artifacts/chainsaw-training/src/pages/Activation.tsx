import { useEffect } from "react";
import { useLocation, Link } from "wouter";
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
  const { deviceId, activationCode, setSession } = useUserSession();

  // If already logged in, go straight to training
  useEffect(() => {
    if (activationCode) {
      setLocation("/training");
    }
  }, [activationCode, setLocation]);
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
          const status = (err as any)?.status;
          const isBondError = status === 409;
          toast({
            variant: "destructive",
            title: "Activation Failed",
            description: isBondError
              ? "This code is already linked to another device. Go to the Admin Panel to reset it."
              : (err as any)?.response?.data?.error || "Invalid activation code.",
          });
        },
      }
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="Chainsaw Courses"
              className="h-16 w-auto object-contain"
            />
            <h1 className="text-3xl font-black tracking-tighter text-primary uppercase leading-none">
              Chainsaw Courses
            </h1>
          </div>
          <p className="uppercase tracking-widest text-xs mt-2 text-muted-foreground">
            Professional Training Portal
          </p>
        </div>
        
        <Card className="border-border bg-card/80 backdrop-blur-sm">
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
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          className="font-mono bg-secondary/50 border-input h-12" 
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
        
        <div className="mt-8 text-center text-xs text-muted-foreground font-mono">
          <p className="opacity-50">DEVICE ID: {deviceId || "INITIALIZING..."}</p>
          <p className="mt-1 opacity-50">AUTHORIZATION REQUIRED</p>
          <Link href="/admin" className="mt-4 inline-block text-primary hover:underline opacity-70 hover:opacity-100 transition-opacity">
            → Admin Panel
          </Link>
        </div>
      </div>
    </div>
  );
}
