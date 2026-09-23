import { Suspense } from "react";
import ResetRequestForm from "@/components/auth/ResetRequestForm";

export const metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetRequestForm />
    </Suspense>
  );
}
