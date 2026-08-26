import { useEffect, useLayoutEffect } from "react";
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

  // Redirect synchronously before the first paint so returning users never see
  // the activation form, even for a single frame. useLayoutEffect fires after
  // DOM mutation but before the browser paints — zero visible gap.
  useLayoutEffect(() => {
    if (activationCode) {
      setLocation("/training");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            userId: res.userId,
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

  // Don't render the form while a session is being restored — prevents a
  // one-frame flash of the activation screen before the redirect fires.
  if (activationCode) {
    return null;
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center overflow-y-auto px-3 py-4 sm:min-h-screen sm:p-4">
      <div className="w-full max-w-md">
        <div className="mb-3 text-center sm:mb-4">
          <div className="flex items-center justify-center gap-1.5 mb-1 sm:gap-2">
            <img
              src={`${import.meta.env.BASE_URL}logo.png?v=4`}
              alt="Chainsaw Courses"
              className="h-10 w-auto object-contain sm:h-14"
            />
            <h1 className="text-lg font-black tracking-tighter text-primary uppercase leading-none sm:text-xl">
              Chainsaw Courses
            </h1>
          </div>
          <p className="uppercase tracking-widest text-[10px] mt-1 text-muted-foreground font-bold leading-tight text-center sm:text-xs">
            Chainsaw Maintenance &amp; Cross Cutting
          </p>
        </div>
        
        <Card className="border-border bg-card/80 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center border-b border-border p-4 mb-3 pb-3 sm:p-6 sm:mb-4 sm:pb-4">
            <CardTitle className="text-lg font-mono uppercase tracking-wide sm:text-xl">System Activation</CardTitle>
            <CardDescription className="font-mono text-xs">
              Enter your access credentials to unlock the training modules.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
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
                           className="font-mono bg-secondary/50 border-input h-10 sm:h-12" 
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
                           className="bg-secondary/50 border-input h-10 sm:h-12" 
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
                           className="bg-secondary/50 border-input h-10 sm:h-12" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                   className="w-full h-12 font-mono font-bold tracking-widest text-sm sm:h-14"
                  disabled={activateCode.isPending}
                >
                  {activateCode.isPending ? "ACTIVATING..." : "ACTIVATE"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="mt-5 shrink-0 text-center text-xs text-muted-foreground font-mono sm:mt-8">
          <p className="break-all opacity-50">DEVICE ID: {deviceId || "INITIALIZING..."}</p>
          <p className="mt-1 opacity-50">AUTHORIZATION REQUIRED</p>
          <Link href="/admin" className="mt-4 inline-block text-primary hover:underline opacity-70 hover:opacity-100 transition-opacity">
            → Admin Panel
          </Link>
          <img
            src={`${import.meta.env.BASE_URL}iirsm-horizontal-logo-transparent.png?v=1`}
            alt="IIRSM Approved Course"
            className="mx-auto mt-5 h-auto w-36 max-w-full object-contain opacity-90 sm:w-44"
          />
        </div>
      </div>
    </div>
  );
}
