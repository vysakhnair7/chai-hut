import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { NAV_BY_ROLE } from "@/constants/navigation";
import { useCurrentUser } from "@/contexts/AuthContext";

/** Home › Section › (Details). Derived from the role's navigation table, so labels never drift. */
export function Breadcrumbs() {
  const user = useCurrentUser();
  const { pathname } = useLocation();
  const items = NAV_BY_ROLE[user.role];
  const section = items.find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  const home = items[0];
  if (!section || !home) return null;

  const isDetail = pathname !== section.path;
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
      <Link to={home.path} className="hover:text-foreground">
        Chai Hut
      </Link>
      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      {isDetail ? (
        <>
          <Link to={section.path} className="hover:text-foreground">
            {section.label}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span className="font-medium text-foreground">Details</span>
        </>
      ) : (
        <span className="font-medium text-foreground">{section.label}</span>
      )}
    </nav>
  );
}
