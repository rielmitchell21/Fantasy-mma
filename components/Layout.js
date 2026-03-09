import Link from "next/link";

export default function Layout({ user, title, children }) {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            Fantasy UFC MVP
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login";
                  }}
                >
                  <button type="submit" className="link-button">
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">Login</Link>
                <Link href="/signup">Sign Up</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="container main">
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}
