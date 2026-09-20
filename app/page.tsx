import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";

export default async function RootPage() {
  const profile = await getCurrentProfile();
  redirect(profile ? "/dashboard" : "/login");
}
