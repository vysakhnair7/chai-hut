import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="That page doesn't exist or isn't available to your role."
      action={
        <Link to="/">
          <Button>Back to start</Button>
        </Link>
      }
    />
  );
}
