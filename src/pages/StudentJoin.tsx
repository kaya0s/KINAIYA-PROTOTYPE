import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Camera, CheckCircle2, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import heroImg from "@/assets/hero-illustration.png";
import { ensureTeacherClass, getClassByCode, listStudentsByCode } from "@/lib/kinaiyaDb";

const STUDENT_SESSION_KEY = "kinaiya_student_session_v1";

const StudentJoin = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialCode = useMemo(() => params.get("code") || "", [params]);
  const defaultTab = useMemo(() => (initialCode ? "code" : "qr"), [initialCode]);

  const [tab, setTab] = useState(defaultTab);
  const [classCode, setClassCode] = useState(initialCode);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [classId, setClassId] = useState<string | null>(null);
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [existingSession, setExistingSession] = useState<{ name?: string } | null>(() => {
    try {
      const raw = localStorage.getItem(STUDENT_SESSION_KEY);
      return raw ? (JSON.parse(raw) as { name?: string }) : null;
    } catch {
      return null;
    }
  });

  const lookup = useCallback(async (rawCode?: string) => {
    setError(null);
    const cleanedCode = (rawCode ?? classCode).trim().toUpperCase();

    if (!cleanedCode || cleanedCode.length < 4) {
      setError("Please enter a valid class code.");
      return;
    }

    setClassCode(cleanedCode);
    setLoading(true);
    try {
      const classRow = await getClassByCode(cleanedCode);
      if (!classRow) {
        setClassId(null);
        setStudents([]);
        setSelectedStudentId("");
        setError("Class code not found. Ask your teacher for the correct code.");
        return;
      }

      setClassId(classRow.class_id);
      const list = await listStudentsByCode(cleanedCode);
      setStudents(list);
      setSelectedStudentId(list[0]?.id ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load class roster.");
    } finally {
      setLoading(false);
    }
  }, [classCode]);

  const simulateScan = useCallback(async () => {
    setError(null);
    setScanning(true);
    setScanStatus("scanning");
    try {
      const teacherClass = await ensureTeacherClass("teacher-prototype");
      await lookup(teacherClass.code);
      setScanStatus("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load class code.");
      setScanStatus("error");
    } finally {
      setScanning(false);
    }
  }, [lookup]);

  const join = () => {
    setError(null);
    const cleanedCode = classCode.trim().toUpperCase();

    if (!classId) {
      setError("Enter your class code first.");
      return;
    }

    if (!selectedStudentId) {
      setError("Please select your name.");
      return;
    }

    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) {
      setError("Invalid selection. Try again.");
      return;
    }

    const session = {
      classId,
      classCode: cleanedCode,
      studentId: student.id,
      name: student.name,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(session));
    setExistingSession({ name: student.name });
    navigate("/student");
  };

  useEffect(() => {
    if (initialCode && !classId) {
      void lookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchClass = () => {
    setError(null);
    try {
      localStorage.removeItem(STUDENT_SESSION_KEY);
    } catch {
      // ignore
    }
    setExistingSession(null);
    setClassId(null);
    setStudents([]);
    setSelectedStudentId("");
    setClassCode(initialCode);
    setScanStatus("idle");
  };

  useEffect(() => {
    if (tab !== "qr") {
      setScanStatus("idle");
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "qr") return;
    if (existingSession) return;
    if (classId) return;
    if (loading || scanning) return;

    const t = window.setTimeout(() => {
      void simulateScan();
    }, 650);

    return () => window.clearTimeout(t);
  }, [classId, existingSession, loading, scanning, simulateScan, tab]);

  return (
    <div className="mobile-container bg-background px-5 pb-8 min-h-screen flex flex-col">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button
          onClick={() => navigate("/")}
          className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-foreground text-lg">
            Join Class
          </h1>
          <p className="text-xs text-muted-foreground">
            Scan a QR code or enter your class code
          </p>
        </div>
        <img src={heroImg} alt="Logo" className="w-10 h-10 rounded-xl shadow-sm border border-border" />
      </div>

      {existingSession && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-kinaiya-blue-light border border-kinaiya-blue/20 p-4 mb-4"
        >
          <p className="text-sm text-foreground font-display font-bold">
            You’re already signed in{existingSession.name ? ` as ${existingSession.name}` : ""}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Continue to your dashboard, or switch class to join a different code.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => navigate("/student")}
              className="w-full py-3 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-sm shadow-kinaiya active:scale-[0.98] transition-transform"
            >
              Continue
            </button>
            <button
              onClick={switchClass}
              className="w-full py-3 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Switch class
            </button>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-card border border-border p-5 space-y-4"
      >
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="qr" className="gap-2">
              <Camera className="w-4 h-4" />
              Scan QR
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-2">
              <QrCode className="w-4 h-4" />
              Enter Code
            </TabsTrigger>
          </TabsList>

          <TabsContent value="qr" className="space-y-4">
            <div className="rounded-2xl border border-dashed border-border bg-background/50 p-4">
              <div className="relative overflow-hidden rounded-xl bg-muted/40 border border-border h-44 flex flex-col items-center justify-center text-center px-4">
                {(scanning || loading) && (
                  <>
                    <motion.div
                      className="absolute left-0 right-0 h-1 bg-gradient-kinaiya opacity-70"
                      initial={{ y: 8 }}
                      animate={{ y: [8, 168, 8] }}
                      transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/0 to-background/10 pointer-events-none" />
                  </>
                )}

                {scanStatus === "success" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-kinaiya-green-light border border-kinaiya-green/20 px-3 py-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-kinaiya-green" />
                    <span className="text-xs font-bold text-kinaiya-green">Scanned</span>
                  </motion.div>
                )}

                <QrCode className="w-10 h-10 text-muted-foreground" />
                <p className="text-sm font-display font-bold text-foreground mt-2">
                  {scanning || loading ? "Scanning..." : "Camera preview (mock)"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {scanning || loading
                    ? "Hold steady — finding your class code."
                    : "This prototype auto-scans a demo QR when you open this tab."}
                </p>
              </div>
            </div>

            <button
              onClick={() => void simulateScan()}
              disabled={loading || scanning || !!existingSession}
              className="w-full py-3 rounded-2xl bg-card border border-border text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
            >
              {existingSession ? "Switch class to scan" : scanning || loading ? "Scanning..." : "Scan again (demo)"}
            </button>
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <QrCode className="w-4 h-4" />
              Class Code
            </div>
            <input
              value={classCode}
              onChange={(e) => setClassCode(e.target.value)}
              placeholder="e.g. KIN-3A7F"
              className="w-full px-3 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <button
              onClick={() => void lookup()}
              disabled={loading || !classCode.trim()}
              className="w-full py-3 rounded-2xl bg-muted text-foreground font-display font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? "Checking..." : "Find my class"}
            </button>
          </TabsContent>
        </Tabs>

        {classId && (
          <div className="space-y-2 pt-2">
            <div className="text-xs text-muted-foreground">Select your name</div>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-3 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {students.length === 0 ? (
                <option value="">No students yet</option>
              ) : (
                students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))
              )}
            </select>
            {students.length === 0 && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your teacher needs to add students to the class roster first.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-kinaiya-red-light border border-kinaiya-red/20 p-3">
            <p className="text-sm text-kinaiya-red">{error}</p>
          </div>
        )}

        <button
          onClick={join}
          disabled={!classId || !selectedStudentId || students.length === 0}
          className="w-full py-4 rounded-2xl bg-gradient-kinaiya text-primary-foreground font-display font-bold text-lg shadow-kinaiya active:scale-[0.98] transition-transform disabled:opacity-60 disabled:pointer-events-none"
        >
          Continue
        </button>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Tip: For the workshop MVP, class codes do not expire. Your teacher can
          rotate the code anytime if it gets shared.
        </p>
      </motion.div>
    </div>
  );
};

export default StudentJoin;
