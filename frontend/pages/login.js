import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import { apiRequest, getCurrentUser } from "../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    identifier: "",
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
      await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form)
      });
      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <Layout user={user} title="Log In">
      <section className="card narrow">
        {error ? <p className="error">{error}</p> : null}
        <form className="form-grid" onSubmit={submit}>
          <label>
            Username or email
            <input
              required
              value={form.identifier}
              onChange={(event) => setForm({ ...form, identifier: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </label>
          <button className="button" type="submit">
            Log In
          </button>
        </form>
      </section>
    </Layout>
  );
}
