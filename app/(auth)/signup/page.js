import { Suspense } from "react";
import SignUpForm from "@/components/auth/SignUpForm";

export const metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUpForm />
    </Suspense>
  );
}
