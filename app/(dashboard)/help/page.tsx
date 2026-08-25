import { HelpCenter } from "@/components/help-center";
import { requireAuthenticatedUser } from "@/lib/auth";
import { getUserPermissions } from "@/lib/permissions";

export const metadata = { title: "مرکز آموزش آجر" };

export default async function HelpPage() {
  const user = await requireAuthenticatedUser();
  const permissions = await getUserPermissions(user);
  return <HelpCenter permissions={[...permissions]} />;
}
