export default function AuthLayout({ children }) {
  return (
    <main className="app">
      <div className="container" style={{ maxWidth: 380, paddingTop: 70 }}>
        {children}
      </div>
    </main>
  );
}
