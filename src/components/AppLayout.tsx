import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Bot,
  Brain,
  FileText,
  Home,
  Plus,
  Search,
  Settings,
} from "lucide-react";

const sidebarItems = [
  { icon: Home, label: "Overview", path: "/" },
  { icon: Bot, label: "Robots", path: "/robots" },
  { icon: Brain, label: "Memory Explorer", path: "/memory" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const headerTabs = [
  { label: "Overview", path: "/" },
  { label: "Robots", path: "/robots" },
  { label: "Memory Explorer", path: "/memory" },
  { label: "Analytics", path: "/analytics" },
  { label: "API Docs", path: "/api-docs" },
];

function isActive(pathname: string, path: string) {
  if (path === "/") return pathname === "/";
  return pathname.startsWith(path);
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[68px] flex-col items-center border-r border-[#E5E7EB] bg-white py-4">
        <nav className="mt-14 flex flex-1 flex-col items-center gap-3">
          {sidebarItems.map((item) => {
            const active = isActive(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200 ${
                  active
                    ? "border-[#DBEAFE] bg-[#EFF6FF] text-[#2563EB] shadow-[0_6px_18px_rgba(37,99,235,0.12)]"
                    : "border-transparent text-slate-400 hover:-translate-y-0.5 hover:bg-[#F3F4F6] hover:text-slate-700"
                }`}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F3F5] text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:text-slate-900 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)]"
          aria-label="Add new"
        >
          <Plus className="h-5 w-5" strokeWidth={1.9} />
        </button>
      </aside>

      <div className="ml-[68px] min-h-screen">
        <header className="sticky top-0 z-20 flex h-[68px] items-center border-b border-[#E5E7EB] bg-white px-8">
          <div className="flex min-w-0 items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[linear-gradient(135deg,#2563EB_0%,#7C3AED_55%,#EF4444_100%)] shadow-[0_10px_30px_rgba(59,130,246,0.22)]" />
              <span className="text-sm font-semibold tracking-[0.18em] text-slate-900">KIRO</span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {headerTabs.map((tab) => {
                const active = isActive(location.pathname, tab.path);
                return (
                  <Link
                    key={tab.path}
                    to={tab.path}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[#EFF6FF] text-[#2563EB]"
                        : "text-slate-500 hover:bg-[#F8FAFC] hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full bg-[#F1F3F5] px-4 py-2.5 md:flex md:w-[280px]">
              <Search className="h-4 w-4 text-slate-400" strokeWidth={1.9} />
              <span className="flex-1 text-sm text-slate-400">Search dashboards</span>
              <span className="rounded-full border border-white/70 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 shadow-sm">
                ⌘K
              </span>
            </div>

            <button type="button" className="dashboard-secondary-button hidden sm:inline-flex">
              <FileText className="h-4 w-4" strokeWidth={1.9} />
              Import
            </button>

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#F3F4F6] hover:text-slate-900"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" strokeWidth={1.9} />
              <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#2563EB]" />
            </button>

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#BAE6FD_0%,#DBEAFE_100%)] text-xs font-semibold text-[#1D4ED8]">
              GC
            </div>
          </div>
        </header>

        <main className="px-8 pb-10 pt-8">{children}</main>
      </div>
    </div>
  );
}
