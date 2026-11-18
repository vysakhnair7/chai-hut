import { KeyRound, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { PageHeader } from "@/components/common/PageHeader";
import { Pagination } from "@/components/common/Pagination";
import { DefaultSkeleton } from "@/components/common/QueryBoundary";
import { ActiveBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { ROLE_LABELS } from "@/constants/labels";
import { useCurrentUser } from "@/contexts/AuthContext";
import type { Role, User } from "@/types/auth";
import type { ActiveStatus } from "@/types/common";
import { formatDate } from "@/utils/format";
import { ResetPasswordDialog, UserCreateDialog, UserEditDialog } from "./UserDialogs";
import { useUsers } from "./hooks";

const PAGE_SIZE = 25;
type Action = { kind: "edit" | "reset"; user: User };

export default function UsersPage() {
  const me = useCurrentUser();
  const [role, setRole] = useState<"" | Role>("");
  const [status, setStatus] = useState<"" | ActiveStatus>("");
  const [offset, setOffset] = useState(0);
  const [creating, setCreating] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  const query = useUsers({ role: role || undefined, status: status || undefined, limit: PAGE_SIZE, offset });

  const columns: Column<User>[] = [
    {
      header: "Employee",
      cell: (u) => (
        <div>
          <p className="font-medium">
            {u.full_name} {u.id === me.id && <Badge tone="caramel" className="ml-1">You</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">{u.username}</p>
        </div>
      ),
    },
    { header: "Role", cell: (u) => ROLE_LABELS[u.role] },
    { header: "Status", cell: (u) => <ActiveBadge status={u.status} /> },
    { header: "Added", cell: (u) => formatDate(u.created_at.slice(0, 10)), hideOnSmall: true },
    {
      header: "",
      className: "text-right",
      cell: (u) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" aria-label={`Edit ${u.username}`} onClick={() => setAction({ kind: "edit", user: u })}>
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button size="sm" variant="ghost" aria-label={`Reset password for ${u.username}`} onClick={() => setAction({ kind: "reset", user: u })}>
            <KeyRound className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Employees"
        description="Create staff accounts and choose what each role can do."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden /> Add employee
          </Button>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select aria-label="Filter by role" className="w-40" value={role} onChange={(e) => { setRole(e.target.value as "" | Role); setOffset(0); }}>
            <option value="">All roles</option>
            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value as "" | ActiveStatus); setOffset(0); }}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        {query.isLoading ? (
          <DefaultSkeleton />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.data && query.data.items.length === 0 ? (
          <EmptyState title="No employees found" />
        ) : query.data ? (
          <>
            <DataTable columns={columns} rows={query.data.items} rowKey={(u) => u.id} />
            <Pagination total={query.data.total} limit={query.data.limit} offset={query.data.offset} onChange={setOffset} />
          </>
        ) : null}
      </Card>

      <UserCreateDialog open={creating} onOpenChange={setCreating} />
      {action?.kind === "edit" && (
        <UserEditDialog open onOpenChange={(o) => !o && setAction(null)} user={action.user} isSelf={action.user.id === me.id} />
      )}
      {action?.kind === "reset" && <ResetPasswordDialog open onOpenChange={(o) => !o && setAction(null)} user={action.user} />}
    </>
  );
}
