import { signIn } from "@/auth";
import { redirect } from "next/navigation";

export default function DevLoginPage() {
  if (process.env.NODE_ENV === "production") redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-gray-200 p-8 w-80 shadow-sm">
        <h1 className="font-bold text-gray-900 mb-2">Dev Login</h1>
        <p className="text-sm text-gray-400 mb-6">Bypass auth for testing</p>
        <form action={async () => {
          "use server";
          await signIn("dev-login", { email: "test@databridge.dev", redirectTo: "/app" });
        }}>
          <button type="submit"
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700">
            Login as test@databridge.dev
          </button>
        </form>
      </div>
    </div>
  );
}
