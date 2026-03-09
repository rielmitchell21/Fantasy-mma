import Link from "next/link";
import { useRouter } from "next/router";
import { apiRequest } from "../lib/api";

export default function Layout({ user, title, children }) {
  const router = useRouter();

  async function logout() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <Link href="/" className="brand">
            Fantasy UFC
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <Link href="/dashboard">Dashboard</Link>
                <button className="link-button" onClick={logout}>
                  Logout
                </button>
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

      <main className="container main-content">
        <h1>{title}</h1>
        {children}
      </main>
    </>
  );
}
