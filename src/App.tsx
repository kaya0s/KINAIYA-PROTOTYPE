import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Welcome from "./pages/Welcome";
import StudentHome from "./pages/StudentHome";
import Diagnostic from "./pages/Diagnostic";
import Results from "./pages/Results";
import Lessons from "./pages/Lessons";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentJoin from "./pages/StudentJoin";
import NotFound from "./pages/NotFound";
import ResiliencePack from "./pages/ResiliencePack";
import WordGames from "./pages/WordGames";
import { OfflineSync } from "@/components/OfflineSync";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <OfflineSync />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} />
          <Route path="/student/join" element={<StudentJoin />} />
          <Route path="/student" element={<StudentHome />} />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/results" element={<Results />} />
          <Route path="/lessons" element={<Lessons />} />
          <Route path="/offline-pack" element={<ResiliencePack />} />
          <Route path="/games" element={<WordGames />} />
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
