import { useState } from "react";
import { useLocation } from "wouter";
import { bioHazardSrc } from "../../lib/customIcons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const { setToken } = useAdminSession();
  const { toast } = useToast();
  const login = useAdminLogin();
  
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { data: { password } },
      {
        onSuccess: (data) => {
          if (data.success && data.token) {
            setToken(data.token);
            setLocation("/admin/dashboard");
          } else {
            toast({ variant: "destructive", title: "Access Denied", description: "Invalid credentials." });
          }
        },
        onError: () => {
          toast({ variant: "destructive", title: "Access Denied", description: "Invalid credentials." });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src={bioHazardSrc} style={{ filter: "brightness(0) invert(0.65)" }} alt="biohazard" className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold font-mono tracking-widest uppercase">Admin Portal</h1>
        </div>
        
        <Card className="border-border bg-card/50 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="font-mono text-sm text-muted-foreground uppercase tracking-wider">Authentication Required</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input 
                type="password"
                placeholder="PASSWORD"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 font-mono text-center tracking-widest bg-secondary/50 border-input"
              />
              <Button 
                type="submit" 
                className="w-full h-12 font-mono font-bold tracking-widest"
                disabled={login.isPending || !password}
              >
                {login.isPending ? "VERIFYING..." : "ENTER"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
