import { createFileRoute } from "@tanstack/react-router";
import { NotificationCenter } from "@/components/admin/notification-center";

export const Route = createFileRoute("/admin/notifications")({ component: () => <NotificationCenter /> });
