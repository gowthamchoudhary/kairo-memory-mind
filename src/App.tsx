import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppLayout from "@/components/AppLayout";
import Overview from "@/pages/Overview";
import Robots from "@/pages/Robots";
import Memory from "@/pages/Memory";
import Analytics from "@/pages/Analytics";
import ApiDocs from "@/pages/ApiDocs";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout><Overview /></AppLayout>} />
          <Route path="/robots" element={<AppLayout><Robots /></AppLayout>} />
          <Route path="/memory" element={<AppLayout><Memory /></AppLayout>} />
          <Route path="/analytics" element={<AppLayout><Analytics /></AppLayout>} />
          <Route path="/api-docs" element={<AppLayout><ApiDocs /></AppLayout>} />
          <Route path="/settings" element={<AppLayout><div className="text-muted-foreground">Settings coming soon</div></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
