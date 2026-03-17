"use client";
import { useState, useEffect } from "react";
import { User, Building, CreditCard, Globe, Key, Mail, Plus, Trash2, Copy, Check, Eye, EyeOff, Bot, Users, Link, Inbox, RefreshCw } from "lucide-react";

interface Props {
  user: { id?: string; name?: string | null; email?: string | null; image?: string | null };
  org: { id: string; name: string };
  subscription: { plan: string; status: string; currentPeriodEnd: Date | null; trialEndsAt: Date | null } | null;
  role: string;
}

const LOCALES = [
  { value: "en-US", label: "English" },
  { value: "zh-CN", label: "中文" },
  { value: "ja-JP", label: "日本語" },
];

const PLAN_COLOR: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-600",
  PRO: "bg-blue-100 text-blue-700",
  ENTERPRISE: "bg-purple-100 text-purple-700",
};

// ─── API Keys Tab ──────────────────────────────────────────────────────────

function ApiKeysTab({ role }: { role: string }) {
  const [keys, setKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canManage = ["OWNER", "ADMIN"].includes(role);

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(setKeys).catch(() => {});
  }, []);

  const createKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const data = await res.json();
    if (res.ok) {
      setNewKey(data.key);
      setKeys(k => [data, ...k]);
      setNewKeyName("");
    }
    setCreating(false);
  };

  const deleteKey = async (id: string) => {
    await fetch("/api/keys", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setKeys(k => k.filter(x => x.id !== id));
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* New key revealed */}
      {newKey && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">API key created — copy it now, it won't be shown again</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 font-mono break-all">{newKey}</code>
            <button onClick={() => copy(newKey)} className="shrink-0 flex items-center gap-1 text-xs text-green-700 hover:text-green-900 px-3 py-2 border border-green-200 rounded-lg bg-white">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-green-600 mt-2 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Create */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Create API Key</h3>
          <div className="flex gap-2">
            <input value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === "Enter" && createKey()} />
            <button onClick={createKey} disabled={creating || !newKeyName.trim()}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Use <code className="bg-gray-100 px-1 rounded">Authorization: Bearer &lt;key&gt;</code> header to authenticate API requests.</p>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {keys.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <Key className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            No API keys yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Name", "Key", "Last Used", "Created", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{k.name}</td>
                  <td className="px-4 py-3"><code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{k.keyPrefix}••••••••</code></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <button onClick={() => deleteKey(k.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Email Inboxes Tab ─────────────────────────────────────────────────────

function EmailInboxesTab({ role }: { role: string }) {
  const [inboxes, setInboxes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [address, setAddress] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const canManage = ["OWNER", "ADMIN"].includes(role);

  useEffect(() => {
    fetch("/api/email/inboxes").then(r => r.json()).then(setInboxes).catch(() => {});
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(() => {});
  }, []);

  const create = async () => {
    if (!templateId || !address.trim()) { setError("Template and address required"); return; }
    setCreating(true); setError("");
    const res = await fetch("/api/email/inboxes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId, address }),
    });
    const data = await res.json();
    if (res.ok) { setInboxes(i => [data, ...i]); setAddress(""); setTemplateId(""); }
    else setError(data.error ?? "Failed");
    setCreating(false);
  };

  const remove = async (id: string) => {
    await fetch("/api/email/inboxes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setInboxes(i => i.filter(x => x.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">How it works</p>
        <p className="text-xs text-blue-600">Send an email to your inbox address → DataBridge automatically creates a job and parses it with the linked template. Configure your email provider to forward to <code className="bg-blue-100 px-1 rounded">POST /api/email/inbound</code>.</p>
      </div>

      {canManage && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Create Email Inbox</h3>
          <div className="space-y-3">
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input value={address} onChange={e => setAddress(e.target.value)}
                placeholder="invoices@yourdomain.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={create} disabled={creating}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {inboxes.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <Mail className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            No email inboxes yet
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Address", "Template", "Created", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inboxes.map(inbox => (
                <tr key={inbox.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3"><code className="text-xs font-mono text-gray-700">{inbox.address}</code></td>
                  <td className="px-4 py-3 text-gray-500">{inbox.template?.name}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(inbox.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <button onClick={() => remove(inbox.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Email Accounts (IMAP) Tab ────────────────────────────────────────────

function EmailAccountsTab() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "", email: "", imapHost: "", imapPort: 993, imapSecure: true,
    username: "", password: "", templateId: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string; messageCount?: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    fetch("/api/email-accounts").then(r => r.json()).then(setAccounts).catch(() => {});
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const testConn = async () => {
    setTesting(true); setTestResult(null);
    const res = await fetch("/api/email-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", ...form }),
    });
    setTestResult(await res.json());
    setTesting(false);
  };

  const save = async () => {
    setSaving(true); setError("");
    const res = await fetch("/api/email-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (res.ok) {
      setAccounts(a => [data, ...a]);
      setForm({ name: "", email: "", imapHost: "", imapPort: 993, imapSecure: true, username: "", password: "", templateId: "" });
      setTestResult(null);
    } else {
      setError(data.error ?? "Failed");
    }
    setSaving(false);
  };

  const sync = async (id: string) => {
    setSyncing(id);
    const res = await fetch("/api/email-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "sync" }),
    });
    const data = await res.json();
    if (data.synced !== undefined) {
      alert(`Synced ${data.synced} new email(s)${data.error ? ` — Error: ${data.error}` : ""}`);
    }
    load();
    setSyncing(null);
  };

  const toggle = async (id: string, active: boolean) => {
    await fetch("/api/email-accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/email-accounts?id=${id}`, { method: "DELETE" });
    setAccounts(a => a.filter(x => x.id !== id));
  };

  const PRESETS = [
    { label: "Gmail", host: "imap.gmail.com", port: 993, secure: true },
    { label: "Outlook", host: "outlook.office365.com", port: 993, secure: true },
    { label: "QQ Mail", host: "imap.qq.com", port: 993, secure: true },
    { label: "163 Mail", host: "imap.163.com", port: 993, secure: true },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">IMAP Email Integration</p>
        <p className="text-xs text-blue-600">Connect your mailbox — DataBridge will automatically fetch new emails and create jobs for parsing. Gmail users need to enable App Passwords.</p>
      </div>

      {/* Add account form */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">Add Email Account</h3>

        {/* Presets */}
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => setForm(f => ({ ...f, imapHost: p.host, imapPort: p.port, imapSecure: p.secure }))}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors">
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Display Name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="My Work Inbox"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email Address</label>
            <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value, username: e.target.value }))}
              placeholder="you@company.com" type="email"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">IMAP Host</label>
            <input value={form.imapHost} onChange={e => setForm(f => ({ ...f, imapHost: e.target.value }))}
              placeholder="imap.gmail.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Port</label>
            <input value={form.imapPort} onChange={e => setForm(f => ({ ...f, imapPort: Number(e.target.value) }))}
              type="number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="you@company.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password / App Password</label>
            <div className="flex gap-2">
              <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                type={showPass ? "text" : "password"} placeholder="••••••••"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={() => setShowPass(v => !v)} className="px-3 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Default Template</label>
          <select value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select template...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {testResult && (
          <div className={`text-xs px-3 py-2 rounded-lg ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {testResult.ok ? `✓ Connected — ${testResult.messageCount} messages in INBOX` : `✗ ${testResult.error}`}
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}

        <div className="flex gap-2">
          <button onClick={testConn} disabled={testing || !form.imapHost || !form.password}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button onClick={save} disabled={saving || !form.name || !form.email || !form.imapHost || !form.password}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Accounts list */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${a.active ? "bg-green-400" : "bg-gray-300"}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {a.email} · {a.imapHost}
                      {a.template && <span> · {a.template.name}</span>}
                      {a.lastSyncAt && <span> · Last sync: {new Date(a.lastSyncAt).toLocaleString()}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => sync(a.id)} disabled={syncing === a.id}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded-lg">
                    <RefreshCw className={`w-3 h-3 ${syncing === a.id ? "animate-spin" : ""}`} />
                    Sync
                  </button>
                  <button onClick={() => toggle(a.id, !a.active)}
                    className={`text-xs px-2 py-1 rounded-lg border ${a.active ? "border-gray-200 text-gray-500 hover:bg-gray-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                    {a.active ? "Pause" : "Resume"}
                  </button>
                  <button onClick={() => remove(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Members Tab ──────────────────────────────────────────────────────────

function MembersTab({ role, currentUserId }: { role: string; currentUserId?: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const canManage = ["OWNER", "ADMIN"].includes(role);

  const load = () => {
    fetch("/api/members").then(r => r.json()).then(setMembers).catch(() => {});
    if (canManage) fetch("/api/invites").then(r => r.json()).then(setInvites).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const sendInvite = async () => {
    if (!email.trim()) return;
    setInviting(true); setError(""); setInviteUrl(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role: inviteRole }),
    });
    const data = await res.json();
    if (res.ok) {
      setInviteUrl(data.inviteUrl);
      setEmail("");
      load();
    } else {
      setError(data.error ?? "Failed to send invite");
    }
    setInviting(false);
  };

  const revokeInvite = async (id: string) => {
    await fetch(`/api/invites?id=${id}`, { method: "DELETE" });
    setInvites(i => i.filter(x => x.id !== id));
  };

  const removeMember = async (userId: string) => {
    await fetch(`/api/members?userId=${userId}`, { method: "DELETE" });
    setMembers(m => m.filter(x => x.userId !== userId));
  };

  const changeRole = async (userId: string, newRole: string) => {
    const res = await fetch("/api/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    if (res.ok) load();
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const ROLE_COLOR: Record<string, string> = {
    OWNER: "bg-purple-100 text-purple-700",
    ADMIN: "bg-blue-100 text-blue-700",
    MEMBER: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-4">
      {/* Invite form */}
      {canManage && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">Invite Member</h3>
          <div className="flex gap-2">
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={e => e.key === "Enter" && sendInvite()} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button onClick={sendInvite} disabled={inviting || !email.trim()}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
              <Plus className="w-4 h-4" /> Invite
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}

          {/* Invite link */}
          {inviteUrl && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-green-800 mb-2">Invite sent! Share this link too:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-green-200 rounded-lg px-3 py-2 font-mono break-all">{inviteUrl}</code>
                <button onClick={() => copy(inviteUrl)}
                  className="shrink-0 flex items-center gap-1 text-xs text-green-700 px-3 py-2 border border-green-200 rounded-lg bg-white hover:bg-green-50">
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <button onClick={() => setInviteUrl(null)} className="text-xs text-green-600 mt-2 hover:underline">Dismiss</button>
            </div>
          )}
        </div>
      )}

      {/* Members list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50 bg-gray-50">
          <p className="text-xs font-medium text-gray-500">Members ({members.length})</p>
        </div>
        {members.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
            No members yet
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map(m => (
              <div key={m.userId} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {m.user.image ? (
                    <img src={m.user.image} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                      {m.user.name?.[0] ?? m.user.email?.[0] ?? "?"}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.user.name ?? m.user.email}</p>
                    <p className="text-xs text-gray-400">{m.user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && m.role !== "OWNER" && m.userId !== currentUserId ? (
                    <select value={m.role} onChange={e => changeRole(m.userId, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500">
                      <option value="ADMIN">Admin</option>
                      <option value="MEMBER">Member</option>
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[m.role]}`}>{m.role}</span>
                  )}
                  {canManage && m.role !== "OWNER" && m.userId !== currentUserId && (
                    <button onClick={() => removeMember(m.userId)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {canManage && invites.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 bg-gray-50">
            <p className="text-xs font-medium text-gray-500">Pending Invites ({invites.length})</p>
          </div>
          <div className="divide-y divide-gray-50">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-gray-700">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    Expires {new Date(inv.expiresAt).toLocaleDateString()} · {inv.role}
                  </p>
                </div>
                <button onClick={() => revokeInvite(inv.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Config Tab ────────────────────────────────────────────────────────

function AiConfigTab({ role }: { role: string }) {
  const [config, setConfig] = useState<{ provider: string; apiKeyMasked: string | null; baseUrl: string | null; model: string | null } | null>(null);
  const [provider, setProvider] = useState("anthropic");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const canManage = ["OWNER", "ADMIN"].includes(role);

  useEffect(() => {
    fetch("/api/ai-config").then(r => r.json()).then(data => {
      if (data) {
        setConfig(data);
        setProvider(data.provider ?? "anthropic");
        setBaseUrl(data.baseUrl ?? "");
        setModel(data.model ?? "");
      }
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!apiKey.trim()) { setError("API key is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/ai-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, baseUrl: baseUrl || null, model: model || null }),
    });
    const data = await res.json();
    if (res.ok) {
      setSaved(true);
      setApiKey("");
      setConfig(c => ({ ...c!, provider, apiKeyMasked: `${apiKey.slice(0, 8)}••••••••`, baseUrl: baseUrl || null, model: model || null }));
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(data.error ?? "Failed to save");
    }
    setSaving(false);
  };

  const remove = async () => {
    await fetch("/api/ai-config", { method: "DELETE" });
    setConfig(null);
    setApiKey(""); setBaseUrl(""); setModel("");
  };

  const PROVIDERS = [
    { value: "anthropic", label: "Anthropic (Claude)" },
    { value: "openai", label: "OpenAI (GPT)" },
    { value: "custom", label: "Custom / Compatible API" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium mb-1">Bring your own API key</p>
        <p className="text-xs text-blue-600">Configure your own LLM API key to use for document parsing. This overrides the system default. Your key is stored securely and only used for your organization's jobs.</p>
      </div>

      {config?.apiKeyMasked && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800">Current key</p>
            <p className="text-xs text-gray-400 mt-0.5">
              <span className="capitalize">{config.provider}</span> · <code className="bg-gray-100 px-1.5 py-0.5 rounded">{config.apiKeyMasked}</code>
              {config.model && <span> · model: <code className="bg-gray-100 px-1.5 py-0.5 rounded">{config.model}</code></span>}
              {config.baseUrl && <span> · <code className="bg-gray-100 px-1.5 py-0.5 rounded">{config.baseUrl}</code></span>}
            </p>
          </div>
          {canManage && (
            <button onClick={remove} className="text-gray-300 hover:text-red-500 transition-colors ml-4">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {canManage && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">{config ? "Update API Key" : "Set API Key"}</h3>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Provider</label>
            <select value={provider} onChange={e => setProvider(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={config?.apiKeyMasked ? "Enter new key to replace..." : "sk-... or your API key"}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button onClick={() => setShowKey(v => !v)} className="px-3 py-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600">
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Base URL <span className="text-gray-300">(optional, for custom endpoints)</span></label>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
              placeholder="https://api.anthropic.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Model <span className="text-gray-300">(optional override)</span></label>
            <input value={model} onChange={e => setModel(e.target.value)}
              placeholder="claude-sonnet-4-6"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button onClick={save} disabled={saving || !apiKey.trim()}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
            {saved ? <><Check className="w-4 h-4" /> Saved</> : saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Settings ─────────────────────────────────────────────────────────

export default function SettingsClient({ user, org, subscription, role }: Props) {
  const [tab, setTab] = useState<"profile" | "org" | "billing" | "language" | "api" | "email" | "docs" | "ai" | "members" | "email-accounts">("profile");
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const plan = subscription?.plan ?? "FREE";

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId, seats: 1 }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    else { alert("Failed to create checkout session"); setUpgrading(null); }
  };

  const handleLocaleChange = async (locale: string) => {
    await fetch("/api/locale", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locale }) });
    window.location.reload();
  };

  const tabs = [
    { key: "profile", label: "Profile", icon: User },
    { key: "org", label: "Organization", icon: Building },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "language", label: "Language", icon: Globe },
    { key: "api", label: "API Keys", icon: Key },
    { key: "email", label: "Email Inboxes", icon: Mail },
    { key: "docs", label: "API Docs", icon: Key },
    { key: "ai", label: "AI Config", icon: Bot },
    { key: "members", label: "Members", icon: Users },
    { key: "email-accounts", label: "Email Sync", icon: Inbox },
  ] as const;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Profile</h2>
          <div className="flex items-center gap-4">
            {user.image ? (
              <img src={user.image} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-xl font-bold text-blue-600">
                {user.name?.[0] ?? user.email?.[0] ?? "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-gray-800">{user.name}</p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400">Profile is managed via your auth provider.</p>
        </div>
      )}

      {tab === "org" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Organization</h2>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Organization Name</label>
            <p className="text-gray-800 bg-gray-50 px-3 py-2 rounded-lg text-sm">{org.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Your Role</label>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{role}</span>
          </div>
        </div>
      )}

      {tab === "billing" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Current Plan</h2>
            <div className="flex items-center justify-between">
              <div>
                <span className={`text-sm px-3 py-1 rounded-full font-semibold ${PLAN_COLOR[plan]}`}>{plan}</span>
                {subscription?.status === "TRIALING" && subscription.trialEndsAt && (
                  <p className="text-xs text-orange-500 mt-1">Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}</p>
                )}
                {subscription?.currentPeriodEnd && plan !== "FREE" && (
                  <p className="text-xs text-gray-400 mt-1">Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
                )}
              </div>
              {plan !== "FREE" && <p className="text-sm text-gray-400">${plan === "PRO" ? "20" : "25"}/user/month</p>}
            </div>
          </div>
          {plan === "FREE" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: "PRO", name: "Professional", price: "$20", desc: "Unlimited jobs + webhooks", trial: "14-day free trial" },
                { id: "ENTERPRISE", name: "Enterprise", price: "$25", desc: "SSO + custom AI + SLA", trial: null },
              ].map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-1">{p.name}</h3>
                  <p className="text-2xl font-bold text-gray-900 mb-1">{p.price}<span className="text-sm font-normal text-gray-400">/user/mo</span></p>
                  <p className="text-sm text-gray-400 mb-3">{p.desc}</p>
                  {p.trial && <p className="text-xs text-green-600 mb-3">✓ {p.trial}</p>}
                  <button onClick={() => handleUpgrade(p.id)} disabled={upgrading === p.id}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                    {upgrading === p.id ? "Redirecting..." : `Upgrade to ${p.name}`}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "language" && (
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Language Preference</h2>
          <div className="space-y-2">
            {LOCALES.map(l => (
              <button key={l.value} onClick={() => handleLocaleChange(l.value)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-left">
                <span className="font-medium text-gray-800">{l.label}</span>
                <span className="text-xs text-gray-400">{l.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "api" && <ApiKeysTab role={role} />}
      {tab === "email" && <EmailInboxesTab role={role} />}
      {tab === "ai" && <AiConfigTab role={role} />}
      {tab === "members" && <MembersTab role={role} currentUserId={user.id} />}
      {tab === "email-accounts" && <EmailAccountsTab />}
      {tab === "docs" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-1">REST API</h2>
            <p className="text-sm text-gray-400 mb-4">Authenticate with <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Authorization: Bearer &lt;api_key&gt;</code></p>
            <div className="space-y-4">
              {[
                { method: "GET", path: "/api/jobs", desc: "List jobs. Query: ?status=PARSED&templateId=xxx&limit=50" },
                { method: "POST", path: "/api/jobs", desc: "Create a single job", body: `{\n  "templateId": "...",\n  "fileName": "invoice.txt",\n  "fileContent": "...",\n  "fileUrl": "/api/uploads/...",  // optional\n  "fileType": "text/plain"\n}` },
                { method: "POST", path: "/api/jobs", desc: "Create jobs in batch", body: `{\n  "templateId": "...",\n  "jobs": [\n    { "fileName": "a.txt", "fileContent": "..." },\n    { "fileName": "b.txt", "fileContent": "..." }\n  ]\n}` },
                { method: "GET", path: "/api/jobs/:id", desc: "Get a single job with parsed data" },
                { method: "PATCH", path: "/api/jobs/:id", desc: "Approve / reject / save a job", body: `{\n  "action": "approve" | "reject" | "save",\n  "reviewedData": { ...fields... },  // for approve/save\n  "reviewNote": "optional"\n}` },
                { method: "POST", path: "/api/jobs/batch", desc: "Batch approve or reject", body: `{\n  "action": "approve" | "reject",\n  "jobIds": ["id1", "id2"],\n  "reviewNote": "optional"\n}` },
                { method: "POST", path: "/api/upload", desc: "Upload a file (multipart/form-data), returns extractedText + fileUrl" },
                { method: "POST", path: "/api/upload/batch", desc: "Upload multiple files (up to 20)", body: `FormData: templateId + files[]` },
                { method: "GET", path: "/api/templates", desc: "List templates" },
                { method: "POST", path: "/api/email/inbound", desc: "Inbound email webhook (SendGrid/Postmark/Mailgun compatible)", body: `{\n  "to": "inbox@yourdomain.com",\n  "from": "sender@example.com",\n  "subject": "...",\n  "text": "..."\n}` },
              ].map(({ method, path, desc, body }) => (
                <div key={path + method} className="border border-gray-100 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      method === "GET" ? "bg-blue-100 text-blue-700" :
                      method === "POST" ? "bg-green-100 text-green-700" :
                      "bg-orange-100 text-orange-700"
                    }`}>{method}</span>
                    <code className="text-sm font-mono text-gray-700">{path}</code>
                    <span className="text-xs tex400 ml-auto">{desc}</span>
                  </div>
                  {body && (
                    <pre className="text-xs font-mono bg-gray-900 text-green-400 px-4 py-3 overflow-auto">{body}</pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-800 mb-3">Zapier / Make Integration</h2>
            <p className="text-sm text-gray-500 mb-3">Set your template's webhook format to <strong>Zapier / Make</strong>. When a job is approved, DataBridge will POST this payload to your webhook URL:</p>
            <pre className="text-xs font-mono bg-gray-900 text-green-400 px-4 py-3 rounded-lg overflow-auto">{`{
  "id": "<jobId>",
  "fileName": "invoice.pdf",
  "templateName": "Invoice Parser",
  "status": "APPROVED",
  "data": { ...extracted fields... },
  "approvedAt": "2024-03-15T10:00:00.000Z"
}`}</pre>
            <p className="text-xs text-gray-400 mt-3">In Zapier: use "Webhooks by Zapier" → Catch Hook. In Make: use "Webhooks" → Custom webhook.</p>
          </div>
        </div>
      )}
    </div>
  );
}
