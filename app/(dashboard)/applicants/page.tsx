import { ContactPage } from "@/components/contact-page";
export const metadata = { title: "متقاضیان" };
export default async function Applicants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; duplicate?: string }>;
}) {
  const s = await searchParams;
  return <ContactPage kind="applicant" q={s.q} duplicate={s.duplicate} />;
}
