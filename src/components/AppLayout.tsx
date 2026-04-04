import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Bot, Brain, BarChart3, Settings, Plus, Search, Bell, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";

const navItems = [
  { icon: Home, label: "Overview", path: "/" },
  { icon: Bot, label: "Robots", path: "/robots" },
  { icon: Brain, label: "Memory", path: "/memory" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/robots": "Robots",
  "/memory": "Memory Explorer",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/api-docs": "API Documentation",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const title = pageTitles[location.pathname] || "KIRO";

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-16 bg-card border-r border-border flex flex-col items-center py-4 shrink-0">
        {/* Logo */}
        <Link to="/" className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg mb-6">
          K
        </Link>

        {/* Nav icons */}
        <nav className="flex-1 flex flex-col items-center gap-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5" />
              </Link>
            );
          })}
        </nav>

        {/* Plus button */}
        <button className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mt-auto">
          <Plus className="w-5 h-5" />
        </button>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top nav */}
        <header className="h-14 bg-card border-b border-border flex items-center px-6 gap-4 shrink-0">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          <div className="flex-1" />
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search or ask AI..."
              className="pl-9 h-9 bg-accent border-border text-sm"
            />
          </div>
          <button className="relative w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
          </button>
          <Link
            to="/api-docs"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors"
            title="API Docs"
          >
            <BookOpen className="w-5 h-5" />
          </Link>
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-border flex items-center justify-center text-xs font-semibold text-primary">
            G
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
