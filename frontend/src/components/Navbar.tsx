import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  Shield,
  LogOut,
  ChevronDown,
  UserCheck,
} from "lucide-react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, quickSwitchDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const { isSuccess } = useQuery({
    queryKey: ["health"],
    queryFn: api.getHealth,
    refetchInterval: 15000,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/events?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-border-subtle transition-colors shadow-sm bg-white/95 dark:bg-slate-900/90">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Hamburger menu toggle + Platform Brand */}
        <div className="flex items-center space-x-3 shrink-0">
          <button
            type="button"
            className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition lg:hidden"
            title="Toggle Menu"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="flex items-center space-x-3 group shrink-0 select-none">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center p-2 shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform text-white">
              <Shield className="w-full h-full stroke-[2.25]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-tight text-text-primary">
                  Emergency Response Platform
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-sky-400 border border-blue-500/20">
                  v1.4
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary hidden sm:block">
                Impact Assessment &amp; Resource Intelligence
              </p>
            </div>
          </Link>
        </div>

        {/* Center: Search Bar with Ctrl K shortcut hint */}
        <form
          onSubmit={handleSearchSubmit}
          className="hidden md:flex flex-1 max-w-xl mx-4 relative items-center"
        >
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incidents, locations, report IDs..."
              className="w-full pl-9 pr-16 py-1.5 rounded-xl bg-white dark:bg-slate-800/70 border border-border-subtle text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all shadow-sm"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-tertiary border border-border-subtle shadow-sm">
                Ctrl
              </kbd>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-3 text-text-tertiary border border-border-subtle shadow-sm">
                K
              </kbd>
            </div>
          </div>
        </form>

        {/* Right Controls: Notifications, Theme Switcher, System Online, User Profile */}
        <div className="flex items-center space-x-3 shrink-0">
          {/* Notifications Bell with count badge */}
          <button
            type="button"
            className="relative p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-border-subtle hover:bg-surface-3 text-text-secondary hover:text-text-primary transition shadow-sm"
            title="Notifications (3 active alerts)"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
              3
            </span>
          </button>

          {/* Theme Toggle (Sun / Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white dark:bg-slate-800/80 border border-border-subtle hover:bg-surface-3 text-text-secondary hover:text-text-primary transition group shadow-sm"
            title={theme === "dark" ? "Switch to Light Glassmorphic Theme" : "Switch to Dark Glassmorphic Theme"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-blue-600 group-hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* System Online Badge */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm ${
              isSuccess
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                : "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isSuccess ? "bg-emerald-500 animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-[11px] font-mono">
              {isSuccess ? "System Online" : "System Offline"}
            </span>
          </div>

          {/* User Profile Pill */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-2 pl-1 pr-2.5 py-1 rounded-xl bg-white dark:bg-slate-800/80 border border-border-subtle hover:bg-surface-3 transition shadow-sm"
            >
              <div className="w-7 h-7 rounded-full bg-blue-700 dark:bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user ? user.full_name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-bold text-text-primary leading-tight">
                  {user ? user.full_name.split(" ")[0] : "Admin"}
                </div>
                <div className="text-[10px] text-text-tertiary capitalize font-medium">
                  {user ? user.role : "Administrator"}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-tertiary hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel shadow-2xl p-2 z-50 text-xs space-y-1 animate-fade-in bg-white/95 dark:bg-slate-900/95 border border-border-strong"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="px-2.5 py-2 border-b border-border-subtle">
                  <p className="font-bold text-text-primary">
                    {user ? user.full_name : "Operational Admin"}
                  </p>
                  <p className="text-[11px] text-text-tertiary truncate">
                    {user ? user.email : "admin@emergency.gov"}
                  </p>
                  <span className="inline-block mt-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-sky-400 font-bold uppercase">
                    Role: {user ? user.role : "Admin (Full Access)"}
                  </span>
                </div>

                <div className="pt-1 space-y-1">
                  <button
                    onClick={() => {
                      quickSwitchDemo("admin");
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-text-primary transition font-medium"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
                    <span>Switch to Relief Admin (Demo)</span>
                  </button>
                  <button
                    onClick={() => {
                      quickSwitchDemo("reporter");
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-text-primary transition font-medium"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-500" />
                    <span>Switch to Field Reporter (Demo)</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-border-subtle">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 text-red-600 dark:text-red-400 transition font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
