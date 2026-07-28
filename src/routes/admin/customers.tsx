import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/customers")({ component: Page });

function Page() {
  return (
    <div className="surface-card p-8">
      <h2 className="text-xl font-bold">Customers</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This section is being built out next. Suppliers, Products, Notifications and the AI Assistant are live now.
      </p>
    </div>
  );
}
