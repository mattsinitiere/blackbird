import { Suspense } from "react";
import ProfilePage from "@/components/marketing/ProfilePage";

export const metadata = {
  title: "Your profile",
  description: "View and edit your Blackbird player profile.",
  robots: { index: false, follow: false },
};

export default function Profile() {
  return (
    <Suspense fallback={null}>
      <ProfilePage />
    </Suspense>
  );
}
