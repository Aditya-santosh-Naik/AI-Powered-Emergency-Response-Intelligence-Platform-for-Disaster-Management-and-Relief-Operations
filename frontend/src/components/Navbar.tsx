import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
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
    <header className="sticky top-0 z-50 glass-panel border-b border-border-subtle transition-colors shadow-sm">
      <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Platform Brand */}
        <Link to="/" className="flex items-center space-x-3 group shrink-0 select-none">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center p-2 shadow-lg shadow-sky-500/25 group-hover:scale-105 transition-transform text-white">
            <Shield className="w-full h-full stroke-[2.25]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-text-primary">
                Emergency Response Platform
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-500 dark:text-sky-400 border border-sky-500/20">
                v1.4
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary hidden sm:block">
              Impact Assessment &amp; Resource Intelligence
            </p>
          </div>
        </Link>

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
              placeholder="Search locations, incidents, report IDs..."
              className="w-full pl-9 pr-16 py-1.5 rounded-xl glass-card text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent transition-all"
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
          {/* Notifications Bell */}
          <button
            type="button"
            className="relative p-2 rounded-xl glass-card hover:bg-surface-3 text-text-secondary hover:text-text-primary transition"
            title="Notifications (3 active alerts)"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface-1 animate-pulse" />
          </button>

          {/* Theme Toggle (Sun / Moon) */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl glass-card hover:bg-surface-3 text-text-secondary hover:text-text-primary transition group"
            title={theme === "dark" ? "Switch to Light Glassmorphic Theme" : "Switch to Dark Glassmorphic Theme"}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400 group-hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-sky-600 group-hover:-rotate-12 transition-transform" />
            )}
          </button>

          {/* System Online Badge */}
          <div
            className={`hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium glass-card border ${
              isSuccess
                ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/30 text-red-600 dark:text-red-400"
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
              className="flex items-center space-x-2 pl-1 pr-2.5 py-1 rounded-xl glass-card hover:bg-surface-3 transition"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                {user ? user.full_name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="text-left hidden lg:block">
                <div className="text-xs font-semibold text-text-primary leading-tight">
                  {user ? user.full_name.split(" ")[0] : "Admin"}
                </div>
                <div className="text-[10px] text-text-tertiary capitalize">
                  {user ? user.role : "Administrator"}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-text-tertiary hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl glass-panel shadow-2xl p-2 z-50 text-xs space-y-1 animate-fade-in"
                onMouseLeave={() => setIsUserMenuOpen(false)}
              >
                <div className="px-2.5 py-2 border-b border-border-subtle">
                  <p className="font-semibold text-text-primary">
                    {user ? user.full_name : "Operational Admin"}
                  </p>
                  <p className="text-[11px] text-text-tertiary truncate">
                    {user ? user.email : "admin@emergency.gov"}
                  </p>
                  <span className="inline-block mt-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-500 dark:text-sky-400 font-semibold uppercase">
                    Role: {user ? user.role : "Admin (Full Access)"}
                  </span>
                </div>

                <div className="pt-1 space-y-1">
                  <button
                    onClick={() => {
                      quickSwitchDemo("admin");
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-text-primary transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                    <span>Switch to Relief Admin (Demo)</span>
                  </button>
                  <button
                    onClick={() => {
                      quickSwitchDemo("reporter");
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-surface-3 text-text-secondary hover:text-text-primary transition"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Switch to Field Reporter (Demo)</span>
                  </button>
                </div>

                <div className="pt-1 border-t border-border-subtle">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 text-red-500 dark:text-red-400 transition"
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
