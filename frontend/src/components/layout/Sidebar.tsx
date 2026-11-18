import { Coffee } from "lucide-react";
import { NavLink } from "react-router-dom";
import { NAV_BY_ROLE } from "@/constants/navigation";
import { useCurrentUser } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onNavigate }: SidebarProps) {
  const user = useCurrentUser();
  const items = NAV_BY_ROLE[user.role];

  return (
    <aside
      className={cn(
        "no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-primary text-primary-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "lg:w-[4.5rem]" : "lg:w-64",
      )}
      aria-label="Main navigation"
    >
      <div className="flex h-16 items-center gap-3 px-4">
        <Coffee className="h-6 w-6 shrink-0 text-accent" aria-hidden />
        <span className={cn("text-lg font-bold tracking-tight", collapsed && "lg:hidden")}>Chai Hut</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {items.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-primary-foreground/85 hover:bg-primary-foreground/10",
                collapsed && "lg:justify-center lg:px-0",
              )
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className={cn(collapsed && "lg:hidden")}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
