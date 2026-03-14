"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface TemplateFormProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    prompt: string;
    outputSchema: string;
    webhookUrl: string;
    webhookHeaders: string;
  };
  mode: "create" | "edit";
}

const DEFAULT_SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    field1: { type: "string", description: "Description of field1" },
    field2: { type: "number", description: "Description of field2" }
  },
  required: ["field1"]
}, null, 2);

export default function TemplateForm({ initialData, mode }: TemplateFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: initialData?.name ?? "",
    description: initialData?.description ?? "",
    prompt: initialData?.prompt ?? "",
    outputSchema: initialData?.outputSchema ?? DEFAULT_SCHEMA,
    webhookUrl: initialData?.webhookUrl ?? "",
    webhookHeaders: initialData?.webhookHeaders ?? "",
  });
  const [schemaError, setSchemaError] = useState("");
  const [headersError, setHeadersError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const validateJson = (val: string, setErr: (s: string) => void) => {
    if (!val.trim()) { setErr(""); return true; }
    try { JSON.parse(val); setErr(""); return true; }
    catch (e: any) { setErr(e.message); return false; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateJson(form.outputSchema, setSchemaError)) return;
    if (form.webhookHeaders && !validateJson(form.webhookHeaders, setHeadersError)) return;
    if (!form.name || !form.prompt || !form.outputSchema) {
      setError("Name, prompt, and output schema are required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const url = mode === "edit" ? `/api/templates/${initialData?.id}` : "/api/templates";
      const method = mode === "edit" ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          prompt: form.prompt,
          outputSchema: JSON.parse(form.outputSchema),
          webhookUrl: form.webhookUrl || undefined,
          webhookHeaders: form.webhookHeaders ? JSON.parse(form.webhookHeaders) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push("/app/templates");
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/app/templates" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">
          {mode === "create" ? "New Template" : "Edit Template"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Basic Info</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.name} onChange={set("name")} placeholder="e.g. Invoice Parser"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input value={form.description} onChange={set("description")} placeholder="Optional description"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* AI Prompt */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-1">AI Prompt *</label>
          <p className="text-xs text-gray-400 mb-2">Describe what data to extract and how to structure it.</p>
          <textarea value={form.prompt} onChange={set("prompt")} rows={5}
            placeholder="Extract the following fields from the invoice: vendor name, total amount, invoice date, invoice number, line items..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Output Schema */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Output Schema (JSON) *</label>
            {schemaError && <span className="text-xs text-red-500">{schemaError}</span>}
          </div>
          <p className="text-xs text-gray-400 mb-2">JSON Schema defining the expected output structure.</p>
          <textarea value={form.outputSchema}
            onChange={e => { set("outputSchema")(e); validateJson(e.target.value, setSchemaError); }}
            rows={10}
            className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              schemaError ? "border-red-300 bg-red-50" : "border-gray-200"
            }`} />
        </div>

        {/* Webhook */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 text-sm">Webhook (optional)</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook URL</label>
            <input value={form.webhookUrl} onChange={set("webhookUrl")}
              placeholder="https://your-system.com/api/data"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Webhook Headers (JSON)</label>
              {headersError && <span className="text-xs text-red-500">{headersError}</span>}
            </div>
            <textarea value={form.webhookHeaders}
              onChange={e => { set("webhookHeaders")(e); if (e.target.value) validateJson(e.target.value, setHeadersError); }}
              rows={3} placeholder={'{"Authorization": "Bearer your-token"}'}
              className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                headersError ? "border-red-300 bg-red-50" : "border-gray-200"
              }`} />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            {mode === "create" ? "Create Template" : "Save Changes"}
          </button>
          <Link href="/app/templates"
            className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
