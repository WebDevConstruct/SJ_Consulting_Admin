"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
  const supabase = createClient();
export default function SetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error(
          "Your verification session has expired. Please request a new code.",
        );
      }
      if(userData?.user){
        await handleUpdate();
      }

      const { error: passwordError } =
        await supabase.auth.updateUser({
          password,
        });

      if (passwordError) {
        throw new Error(passwordError.message);
      }

      router.replace("/admin/home");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to set password.",
      );
    } finally {
      setLoading(false);
    }
  }


  const handleUpdate = async()=> {
    const completionResponse = await fetch(
  "/api/admin/auth/complete-setup",
  {
    method: "POST",
  },
);

if (!completionResponse.ok) {
  throw new Error("Password was saved, but setup could not be completed.");
}

router.replace("/admin/home");
  }

  return (
    <main>
      <h1>Create your admin password</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        <label htmlFor="confirm-password">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Saving password…" : "Create password"}
        </button>
      </form>
    </main>
  );
}