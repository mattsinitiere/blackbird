import { redirect } from "next/navigation";

// Temporary: the marketing page lands here in a later phase. Until then the
// root sends everyone to the app shell, whose own guard handles sign-in.
export default function Root() {
  redirect("/app");
}
