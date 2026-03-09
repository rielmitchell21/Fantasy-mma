import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { apiRequest, getCurrentUser } from "../lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    getCurrentUser()
      .then((me) => {
        if (me) router.replace("/dashboard");
        setUser(me);
      })
      .catch(() => {});
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await apiRequest("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify(form)
      });
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <Layout user={user} title="Sign Up">
      <section className="card narrow">
        {error ? <p className="error">{error}</p> : null}
        <form className="form-grid" onSubmit={submit}>
          <label>
            Username
            <input
              required
              minLength={3}
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <button className="button" type="submit">
            Create Account
          </button>
        </form>
      </section>
    </Layout>
  );
}
