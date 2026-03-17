"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [invite, setInvite] = useState<{ email: string; orgName: string; role: string } | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInvite(data);
      })
      .catch(() => setError("Failed to load invite"));
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    const res = await fetch(`/api/invites/${token}`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.push("/app"), 2000);
    } else {
      setError(data.error ?? "Failed to accept invite");
      if (data.error === "Login required") {
        router.push(`/login?callbackUrl=/invite/${token}`);
      }
    }
    setAccepting(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 w-full max-w-md text-center">
        {done ? (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You're in!</h1>
            <p className="text-gray-400 text-sm">Redirecting to dashboard...</p>
          </>
        ) : error ? (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invite Error</h1>
            <p className="text-red-500 text-sm">{error}</p>
          </>
        ) : !invite ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              🎉
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">You're invited!</h1>
            <p className="text-gray-500 text-sm mb-1">
              Join <span className="font-semibold text-gray-800">{invite.orgName}</span> on DataBridge
            </p>
            <p className="text-xs text-gray-400 mb-6">
              as <span className="capitalize font-medium">{invite.role.toLowerCase()}</span> · {invite.email}
            </p>
            <button onClick={accept} disabled={accepting}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {accepting ? "Accepting..." : "Accept Invitation"}
            </button>
            <p className="text-xs text-gray-400 mt-4">
              You'll need to be logged in with <strong>{invite.email}</strong>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
