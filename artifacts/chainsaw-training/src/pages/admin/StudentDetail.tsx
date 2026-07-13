import { useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, MonitorSmartphone, FileSignature, CheckCircle, XCircle } from "lucide-react";
import { useGetStudent, useResetDeviceBond, getGetStudentQueryKey } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";
import { useToast } from "@/hooks/use-toast";

export default function StudentDetail() {
  const { id } = useParams();
  const studentId = id ? parseInt(id) : 0;
  
  const [, setLocation] = useLocation();
  const { adminToken, isReady } = useAdminSession();
  const { toast } = useToast();

  const { data: student, isLoading, refetch } = useGetStudent(studentId, {
    query: { queryKey: getGetStudentQueryKey(studentId), enabled: !!adminToken && !!studentId }
  });
  const resetBond = useResetDeviceBond();

  useEffect(() => {
    if (isReady && !adminToken) {
      setLocation("/admin");
    }
  }, [isReady, adminToken, setLocation]);

  const handleResetDevice = () => {
    if (confirm("Are you sure you want to clear this device bond? The student will need to re-authenticate on a new device.")) {
      resetBond.mutate({ studentId }, {
        onSuccess: () => {
          toast({ title: "Bond Cleared", description: "Device bond has been reset." });
          refetch();
        }
      });
    }
  };

  if (isLoading || !student) {
    return <div className="min-h-screen bg-background flex justify-center items-center font-mono text-primary uppercase">Retrieving Data...</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild className="font-mono text-xs">
            <Link href="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> ROSTER</Link>
          </Button>
          <div className="font-mono font-bold uppercase tracking-widest text-sm border-l border-border pl-4">
            Record: {student.fullName}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-2 border-border bg-card/30">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-widest flex items-center">
                <User className="w-4 h-4 mr-2" /> Identity Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase">Full Name</div>
                  <div className="font-bold">{student.fullName}</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase">Email Address</div>
                  <div className="font-mono text-sm">{student.email}</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase">Activation Code</div>
                  <div className="font-mono text-sm">{student.activationCode || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-mono text-muted-foreground uppercase">Registration Date</div>
                  <div className="font-mono text-sm">{new Date(student.activatedAt).toLocaleDateString()}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/30">
            <CardHeader>
              <CardTitle className="font-mono uppercase tracking-widest flex items-center">
                <img src="/bio-hazard.png" alt="" className="w-4 h-4 mr-2 inline" /> Security Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono text-muted-foreground uppercase">Waiver</span>
                  {student.waiverSigned ? 
                    <Badge variant="outline" className="text-primary border-primary rounded-none text-[10px] font-mono">SIGNED</Badge> : 
                    <Badge variant="outline" className="text-destructive border-destructive rounded-none text-[10px] font-mono">MISSING</Badge>
                  }
                </div>
                {student.waiverSignedAt && (
                  <div className="font-mono text-xs opacity-70">
                    {new Date(student.waiverSignedAt).toLocaleString()}
                  </div>
                )}
                {student.waiverPdfUrl && (
                  <a href={student.waiverPdfUrl} target="_blank" rel="noreferrer" className="text-primary text-xs font-mono hover:underline mt-1 inline-flex items-center">
                    <FileSignature className="w-3 h-3 mr-1" /> VIEW PDF
                  </a>
                )}
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono text-muted-foreground uppercase">Device Bond</span>
                  {student.deviceBonded ? 
                    <Badge variant="outline" className="text-primary border-primary rounded-none text-[10px] font-mono flex items-center"><MonitorSmartphone className="w-3 h-3 mr-1"/> ACTIVE</Badge> : 
                    <Badge variant="outline" className="text-muted-foreground rounded-none text-[10px] font-mono">NONE</Badge>
                  }
                </div>
                <div className="font-mono text-[10px] opacity-50 break-all mb-3">
                  {student.deviceId}
                </div>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="w-full font-mono text-xs h-8"
                  onClick={handleResetDevice}
                  disabled={resetBond.isPending || !student.deviceBonded}
                >
                  {resetBond.isPending ? "CLEARING..." : "RESET DEVICE BOND"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card/30">
          <CardHeader>
            <CardTitle className="font-mono uppercase tracking-widest flex items-center">
              <CheckCircle className="w-4 h-4 mr-2" /> Assessment History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {student.quizResults.length > 0 ? (
              <div className="space-y-4">
                {student.quizResults.map((result, i) => (
                  <div key={i} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-secondary/20 border border-border rounded-md gap-4">
                    <div>
                      <div className="font-bold font-mono uppercase text-sm">{result.moduleTitle}</div>
                      <div className="text-xs text-muted-foreground font-mono">{new Date(result.attemptedAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground font-mono uppercase">Score</div>
                        <div className="font-mono font-bold">{result.score}%</div>
                      </div>
                      {result.passed ? (
                        <CheckCircle className="w-6 h-6 text-primary" />
                      ) : (
                        <XCircle className="w-6 h-6 text-destructive" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 font-mono text-sm text-muted-foreground opacity-70">
                NO ASSESSMENTS TAKEN
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
}
