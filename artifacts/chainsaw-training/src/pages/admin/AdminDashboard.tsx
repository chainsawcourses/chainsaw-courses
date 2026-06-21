import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldAlert, Users, TrendingUp, Search, Plus, LogOut, Video } from "lucide-react";
import { useGetAdminStats, useListStudents, useCreateActivationCode } from "@workspace/api-client-react";
import { useAdminSession } from "../../contexts/AdminContext";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { adminToken, clearToken } = useAdminSession();
  
  const { data: stats } = useGetAdminStats({ query: { enabled: !!adminToken } });
  const { data: students, refetch: refetchStudents } = useListStudents({ query: { enabled: !!adminToken } });
  const createCode = useCreateActivationCode();

  const [search, setSearch] = useState("");
  const [createCodeOpen, setCreateCodeOpen] = useState(false);
  const [newCodeNotes, setNewCodeNotes] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");

  useEffect(() => {
    if (!adminToken) {
      setLocation("/admin");
    }
  }, [adminToken, setLocation]);

  const handleLogout = () => {
    clearToken();
    setLocation("/admin");
  };

  const handleCreateCode = () => {
    createCode.mutate(
      { data: { code: `CHT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, notes: newCodeNotes } },
      {
        onSuccess: (data) => {
          setGeneratedCode(data.code);
          setNewCodeNotes("");
        }
      }
    );
  };

  const filteredStudents = students?.filter(s => 
    s.fullName.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase()) ||
    s.activationCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center font-mono font-bold uppercase tracking-widest text-sm text-primary">
            <ShieldAlert className="w-5 h-5 mr-2" /> OVERSEER
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
              <Link href="/admin/videos">
                <Video className="w-4 h-4 mr-2" /> VIDEO SETTINGS
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="font-mono text-xs">
              <LogOut className="w-4 h-4 mr-2" /> LOGOUT
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Total Students</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.totalStudents || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Active This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.activeThisWeek || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Completion Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.completionRate || 0}%</div>
            </CardContent>
          </Card>
          <Card className="bg-secondary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Waivers Signed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-black font-mono">{stats?.waiversSigned || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Students Table */}
        <Card className="border-border bg-card/30">
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="font-mono uppercase tracking-widest">Student Roster</CardTitle>
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search students..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 font-mono text-xs bg-background"
                />
              </div>
              <Button size="sm" onClick={() => { setCreateCodeOpen(true); setGeneratedCode(""); }} className="h-9 font-mono text-xs">
                <Plus className="w-4 h-4 mr-1" /> NEW CODE
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-xs">OPERATOR</TableHead>
                    <TableHead className="font-mono text-xs">CODE</TableHead>
                    <TableHead className="font-mono text-xs">PROGRESS</TableHead>
                    <TableHead className="font-mono text-xs">WAIVER</TableHead>
                    <TableHead className="font-mono text-xs text-right">ACTION</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents?.map((student) => (
                    <TableRow key={student.id} className="border-border hover:bg-secondary/10">
                      <TableCell>
                        <div className="font-bold text-sm">{student.fullName}</div>
                        <div className="text-xs text-muted-foreground">{student.email}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs opacity-70">
                        {student.activationCode || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary" 
                              style={{ width: `${(student.completedModules / (student.totalModules || 1)) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs text-muted-foreground">
                            {student.completedModules}/{student.totalModules}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {student.waiverSigned ? (
                          <Badge variant="outline" className="text-primary border-primary text-[10px] font-mono rounded-none">SIGNED</Badge>
                        ) : (
                          <Badge variant="outline" className="text-destructive border-destructive text-[10px] font-mono rounded-none">MISSING</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="font-mono text-xs h-7" asChild>
                          <Link href={`/admin/students/${student.id}`}>VIEW</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredStudents?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono text-sm">
                        NO RECORDS FOUND
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={createCodeOpen} onOpenChange={setCreateCodeOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-widest">Generate Access Code</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {generatedCode ? (
              <div className="text-center p-6 bg-secondary/30 border border-border rounded-md">
                <div className="text-xs text-muted-foreground font-mono mb-2 uppercase">Code Generated Successfully</div>
                <div className="text-2xl font-black font-mono text-primary tracking-widest">{generatedCode}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase">Optional Notes (e.g. Buyer Info)</label>
                <Input 
                  value={newCodeNotes} 
                  onChange={(e) => setNewCodeNotes(e.target.value)} 
                  placeholder="Order #12345"
                  className="font-mono"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            {!generatedCode ? (
              <Button onClick={handleCreateCode} disabled={createCode.isPending} className="font-mono w-full font-bold">
                {createCode.isPending ? "GENERATING..." : "GENERATE NOW"}
              </Button>
            ) : (
              <Button onClick={() => setCreateCodeOpen(false)} className="font-mono w-full font-bold">
                DONE
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
