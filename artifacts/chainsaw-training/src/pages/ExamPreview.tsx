import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, ArrowLeft, FileDown } from "lucide-react";
import { useUserSession } from "../contexts/UserContext";

function PreviewCertificateButton() {
  const { activationCode, deviceId } = useUserSession();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    const code = activationCode ?? "ADMIN-PREVIEW";
    const device = deviceId ?? "admin-preview-device-001";
    setLoading(true);
    try {
      const res = await fetch("/api/certificate", {
        headers: { activationcode: code, deviceid: device },
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const w = window.open(url, "_blank");
      if (!w) {
        const a = document.createElement("a");
        a.href = url; a.target = "_blank"; a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      // silent retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={loading}
      className="w-full h-14 font-mono font-bold tracking-widest gap-2"
    >
      <FileDown className="w-5 h-5" />
      {loading ? "GENERATING..." : "VIEW CERTIFICATE"}
    </Button>
  );
}

export default function ExamPreview() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 left-4 z-50">
        <Button variant="outline" size="sm" asChild className="font-mono text-xs">
          <Link href="/admin/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> ADMIN</Link>
        </Button>
      </div>

      <Card className="w-full max-w-2xl border-border bg-card/80 backdrop-blur-sm relative z-10">
        <CardContent className="p-8 text-center flex flex-col items-center">
          <Award className="w-20 h-20 text-primary mb-6" />

          <h1 className="text-3xl font-black font-mono uppercase tracking-wide mb-2">
            Certification Exam Passed
          </h1>

          <p className="text-muted-foreground font-mono mb-2">
            You scored 42 out of 45 (93%)
          </p>

          <p className="text-sm text-primary font-mono mb-8">
            Congratulations — you have met the 80% pass mark for the final summative exam.
          </p>

          <div className="flex flex-col gap-3 w-full">
            <PreviewCertificateButton />
            <Button asChild variant="outline" className="w-full h-12 font-mono font-bold tracking-widest">
              <Link href="/training">BACK TO TRAINING</Link>
            </Button>
          </div>

          <p className="mt-6 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">
            Admin preview — this is what students see when they pass the final exam
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
