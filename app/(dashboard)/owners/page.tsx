import { ContactPage } from "@/components/contact-page";
export const metadata = { title: "مالکان" };
export default async function Owners({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; duplicate?: string }>;
}) {
  const s = await searchParams;
  return <ContactPage kind="owner" q={s.q} duplicate={s.duplicate} />;
}
