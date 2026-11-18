import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACCOUNT_PATH } from "@/constants/navigation";
import { ROLE_LABELS } from "@/constants/labels";
import { useCurrentUser, useAuth } from "@/contexts/AuthContext";
import { Breadcrumbs } from "./Breadcrumbs";

interface HeaderProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}

export function Header({ collapsed, onToggleCollapsed, onOpenMobile }: HeaderProps) {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="no-print sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
      </Button>
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-3">
        <Link to={ACCOUNT_PATH} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted" title="My account">
          <span className="hidden text-right text-sm leading-tight sm:block">
            <span className="block font-semibold">{user.full_name}</span>
            <span className="block text-xs text-muted-foreground">@{user.username}</span>
          </span>
          <Badge tone="caramel">{ROLE_LABELS[user.role]}</Badge>
        </Link>
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Log out</span>
        </Button>
      </div>
    </header>
  );
}
