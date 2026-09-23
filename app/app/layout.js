import RegisterSW from "@/components/RegisterSW";

export const metadata = {
  title: "Blackbird",
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }) {
  return (
    <>
      <RegisterSW />
      {children}
    </>
  );
}
