import { Suspense } from "react";
import SetPasswordForm from "@/components/auth/SetPasswordForm";

export const metadata = {
  title: "New password",
  robots: { index: false, follow: false },
};

export default function ResetConfirmPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm mode="reset" />
    </Suspense>
  );
}
