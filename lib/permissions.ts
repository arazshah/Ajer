import type { Role } from "@prisma/client";
export type Action =
  | "view_operations"
  | "manage_users"
  | "manage_settings"
  | "delete_user";
export function can(role: Role, action: Action) {
  if (role === "ADMIN") return true;
  if (role === "MANAGER") return action === "view_operations";
  return action === "view_operations";
}
