import RegisterSW from "@/components/RegisterSW";

export const metadata = {
  title: { absolute: "Blackbird" },
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
