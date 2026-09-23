import { Suspense } from "react";
import SetPasswordForm from "@/components/auth/SetPasswordForm";

export const metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm mode="invite" />
    </Suspense>
  );
}
