import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Lock, PlayCircle, CheckCircle, ShieldAlert, Award } from "lucide-react";
import { useListModules, useGetProgressSummary } from "@workspace/api-client-react";
import { useUserSession } from "../contexts/UserContext";
import { useRemoteConfig } from "@/hooks/useRemoteConfig";

export default function TrainingList() {
  const [, setLocation] = useLocation();
  const { activationCode, deviceId, fullName } = useUserSession();

  const { data: modules, isLoading: isLoadingModules } = useListModules({
    query: { enabled: !!activationCode && !!deviceId }
  });
  
  const { data: summary, isLoading: isLoadingSummary } = useGetProgressSummary({
    query: { enabled: !!activationCode && !!deviceId }
  });

  const { modulesConfig } = useRemoteConfig();

  useEffect(() => {
    if (!activationCode || !deviceId) {
      setLocation("/");
    }
  }, [activationCode, deviceId, setLocation]);

  if (isLoadingModules || isLoadingSummary) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-primary font-mono tracking-widest uppercase">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          Loading Modules...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-primary" />
            <h1 className="font-mono font-black tracking-tighter text-lg uppercase">Chainsaw Manual</h1>
          </div>
          <div className="font-mono text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-4">
            <span className="hidden sm:inline-block">OPERATOR: {fullName}</span>
            <Button variant="outline" size="sm" className="font-mono text-xs border-primary text-primary hover:bg-primary hover:text-primary-foreground" asChild>
              <Link href="/mock-test">MOCK EXAM</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        
        {/* Progress Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-secondary/20 border-border md:col-span-2">
            <CardContent className="p-6 flex flex-col justify-center h-full">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <div className="text-sm font-mono text-muted-foreground uppercase tracking-wider mb-1">Overall Progress</div>
                  <div className="text-4xl font-black font-mono">{summary?.percentComplete || 0}%</div>
                </div>
                {summary?.certificateEarned && (
                  <Badge variant="default" className="bg-primary hover:bg-primary text-primary-foreground font-mono">
                    <Award className="w-3 h-3 mr-1" /> CERTIFIED
                  </Badge>
                )}
              </div>
              <Progress value={summary?.percentComplete || 0} className="h-3 bg-secondary" />
            </CardContent>
          </Card>
          
          <Card className="bg-secondary/20 border-border">
            <CardContent className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Modules</span>
                <span className="font-mono font-bold">{summary?.completedModules || 0} / {summary?.totalModules || 0}</span>
              </div>
              <div className="flex justify-between items-center border-b border-border pb-2">
                <span className="text-xs font-mono text-muted-foreground uppercase">Quizzes Passed</span>
                <span className="font-mono font-bold">{summary?.quizzesPassed || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-muted-foreground uppercase">Status</span>
                <span className={`font-mono font-bold text-xs ${summary?.certificateEarned ? 'text-primary' : 'text-muted-foreground'}`}>
                  {summary?.certificateEarned ? 'COMPLETE' : 'IN PROGRESS'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Module List */}
        <div>
          <h2 className="text-xl font-mono font-bold uppercase tracking-wider mb-6 flex items-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full" />
            Training Modules
          </h2>
          
          <div className="space-y-3">
            {modules?.map((module, index) => {
              const rc = modulesConfig.find((m) => m.id === module.id);
              const title = rc?.title || module.title;
              const description = rc?.description || module.description;
              return <Card
                key={module.id}
                className={`border-border transition-all duration-200 ${module.isLocked ? 'opacity-50 grayscale hover:opacity-50 bg-background' : 'hover:border-primary/50 bg-card/40 hover:bg-card/80'}`}
              >
                <CardContent className="p-0 sm:flex items-stretch">
                  <div className="sm:w-48 h-32 sm:h-auto bg-secondary relative shrink-0 border-b sm:border-b-0 sm:border-r border-border flex items-center justify-center overflow-hidden">
                    {module.thumbnailUrl ? (
                      <img src={module.thumbnailUrl} alt={title} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="font-mono text-4xl font-black text-muted/30">{String(index + 1).padStart(2, '0')}</div>
                    )}
                    {module.isLocked && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-[2px] flex items-center justify-center">
                        <Lock className="w-8 h-8 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <h3 className="font-bold text-lg leading-tight font-mono uppercase">{title}</h3>
                        <div className="flex gap-2 shrink-0">
                          {module.isHighRisk && (
                            <Badge variant="destructive" className="font-mono text-[10px] rounded-none py-0.5">
                              <ShieldAlert className="w-3 h-3 mr-1" /> HIGH RISK
                            </Badge>
                          )}
                          {module.isCompleted && !module.quizPassed && (
                            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-muted-foreground rounded-none">
                              VIDEO DONE
                            </Badge>
                          )}
                          {module.quizPassed && (
                            <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary rounded-none">
                              <CheckCircle className="w-3 h-3 mr-1" /> PASSED
                            </Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        {Math.floor(module.duration / 60)} MIN {module.duration % 60} SEC
                      </div>
                      {!module.isLocked && (
                        <div className="flex gap-2">
                          {module.isCompleted && !module.quizPassed && (
                            <Button size="sm" variant="outline" className="h-8 font-mono text-xs border-primary text-primary" asChild>
                              <Link href={`/quiz/${module.id}`}>TAKE QUIZ</Link>
                            </Button>
                          )}
                          <Button size="sm" className="h-8 font-mono text-xs" asChild>
                            <Link href={`/training/${module.id}`}>
                              <PlayCircle className="w-3 h-3 mr-2" /> {module.isCompleted ? 'REWATCH' : 'START'}
                            </Link>
                          </Button>
                        </div>
                      )}
                      {module.isLocked && (
                        <Button size="sm" variant="ghost" className="h-8 font-mono text-xs text-muted-foreground pointer-events-none">
                          LOCKED
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>;
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
