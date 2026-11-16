import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Shield } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { adminAction, adminWhoami } from "../api/adminClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";

const PAGE_SIZE = 20;
const FEATURES = ["text", "image", "chat", "plan"];
const COLORS = {
  text: "#22c55e",
  image: "#3b82f6",
  chat: "#f59e0b",
  plan: "#a855f7",
  guest: "#64748b",
  registered: "#22c55e",
  count: "#22c55e",
};

function messageFor(error, t) {
  const code = error?.code;
  if (code) {
    const translated = t(`admin.errors.${code}`);
    if (translated !== `admin.errors.${code}`) return translated;
  }
  return error?.message || t("admin.errors.UNAVAILABLE");
}

function formatWhen(value, lang) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(lang === "ar" ? "ar" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortDay(value) {
  return String(value || "").slice(5);
}

function chartTooltipStyle() {
  return {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--text-primary)",
  };
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {children}
    </section>
  );
}

function Status({ children }) {
  return <p className="text-sm text-[var(--text-secondary)]">{children}</p>;
}

function ErrorNote({ children, onRetry, retryLabel }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
      <p>{children}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="mt-2 font-medium underline">
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
      <p className="text-xs text-[var(--text-secondary)]">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-[var(--text-primary)]">{value}</p>
    </div>
  );
}

function DailyChart({ data, bars, t }) {
  if (!data.length) return <Status>{t("admin.empty")}</Status>;
  return (
    <div className="h-72 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 12 }} width={32} />
          <Tooltip contentStyle={chartTooltipStyle()} labelFormatter={(label) => label} />
          <Legend />
          {bars.map((key) => (
            <Bar key={key} dataKey={key} name={t(`admin.series.${key}`)} fill={COLORS[key]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankList({ items, empty }) {
  if (!items?.length) return <Status>{empty}</Status>;
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate text-[var(--text-primary)]">{item.name}</span>
          <span className="tabular-nums text-[var(--text-secondary)]">{item.count}</span>
        </li>
      ))}
    </ul>
  );
}

function fieldClass() {
  return "w-full rounded-xl border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-green)]";
}

function formFromProfile(profile) {
  return {
    full_name: profile?.full_name || "",
    age: profile?.age ?? "",
    sex: profile?.sex || "",
    height_cm: profile?.height_cm ?? "",
    weight_kg: profile?.weight_kg ?? "",
    activity_level: profile?.activity_level || "",
    goal: profile?.goal || "",
    allergies: Array.isArray(profile?.allergies) ? profile.allergies.join("\n") : "",
  };
}

export default function AdminDashboard() {
  const { session } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const token = session?.access_token || "";
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState("overview");
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState("");
  const [statsLoading, setStatsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState(null);
  const [usersError, setUsersError] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(formFromProfile(null));
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (!token) {
      navigate("/", { replace: true });
      return undefined;
    }
    let active = true;
    adminWhoami(token).then((isAdmin) => {
      if (!active) return;
      if (!isAdmin) {
        navigate("/", { replace: true });
        return;
      }
      setAllowed(true);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate, token]);

  const loadStats = useCallback(async () => {
    if (!token) return;
    setStatsLoading(true);
    setStatsError("");
    try {
      setStats(await adminAction(token, "stats"));
    } catch (error) {
      setStatsError(messageFor(error, t));
    } finally {
      setStatsLoading(false);
    }
  }, [t, token]);

  const loadUsers = useCallback(async () => {
    if (!token) return;
    setUsersLoading(true);
    setUsersError("");
    try {
      setUsers(await adminAction(token, "listUsers", { page, pageSize: PAGE_SIZE, query: submittedQuery }));
    } catch (error) {
      setUsersError(messageFor(error, t));
    } finally {
      setUsersLoading(false);
    }
  }, [page, submittedQuery, t, token]);

  useEffect(() => {
    if (!allowed || tab === "users") return undefined;
    const timer = setTimeout(() => {
      void loadStats();
    }, 0);
    return () => clearTimeout(timer);
  }, [allowed, loadStats, tab]);

  useEffect(() => {
    if (!allowed || tab !== "users") return undefined;
    const timer = setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => clearTimeout(timer);
  }, [allowed, loadUsers, tab]);

  const totals = useMemo(() => {
    const rows = stats?.aiUsage || [];
    return rows.reduce(
      (sum, row) => ({
        requests: sum.requests + row.guest + row.registered,
        guests: sum.guests + row.guest,
      }),
      { requests: 0, guests: 0 },
    );
  }, [stats]);

  async function openUser(userId) {
    setSelected({ user: { id: userId }, profile: null, foodLog: [], bmiHistory: [], dailyLog: [] });
    setEditing(false);
    setActionError("");
    setDetailLoading(true);
    try {
      const detail = await adminAction(token, "getUser", { userId });
      setSelected(detail);
      setForm(formFromProfile(detail.profile));
    } catch (error) {
      setActionError(messageFor(error, t));
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!selected?.user?.id) return;
    setSaving(true);
    setActionError("");
    try {
      await adminAction(token, "updateUser", {
        userId: selected.user.id,
        profile: {
          full_name: form.full_name,
          age: form.age === "" ? null : Number(form.age),
          sex: form.sex,
          height_cm: form.height_cm === "" ? null : Number(form.height_cm),
          weight_kg: form.weight_kg === "" ? null : Number(form.weight_kg),
          activity_level: form.activity_level,
          goal: form.goal,
          allergies: form.allergies
            .split(/\r?\n/)
            .map((item) => item.trim())
            .filter(Boolean),
        },
      });
      setEditing(false);
      await openUser(selected.user.id);
      void loadUsers();
    } catch (error) {
      setActionError(messageFor(error, t));
    } finally {
      setSaving(false);
    }
  }

  async function runDelete() {
    if (!confirm || !selected?.user?.id) return;
    setSaving(true);
    setActionError("");
    try {
      await adminAction(token, confirm === "account" ? "deleteUserAccount" : "deleteUserData", {
        userId: selected.user.id,
      });
      setConfirm(null);
      if (confirm === "account") {
        setSelected(null);
        void loadUsers();
      } else {
        await openUser(selected.user.id);
        void loadUsers();
      }
    } catch (error) {
      setActionError(messageFor(error, t));
      setConfirm(null);
    } finally {
      setSaving(false);
    }
  }

  if (checking || !allowed) {
    return (
      <div className="grid min-h-40 place-items-center text-[var(--text-secondary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-green)]" aria-label={t("common.loading")} />
      </div>
    );
  }

  const tabs = [
    ["overview", "admin.tabs.overview"],
    ["users", "admin.tabs.users"],
    ["usage", "admin.tabs.usage"],
  ];

  return (
    <div className="text-left rtl:text-right">
      <header className="mb-6">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-[var(--accent-green)]">
          <Shield className="h-4 w-4" aria-hidden="true" />
          {t("admin.eyebrow")}
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">{t("admin.title")}</h1>
      </header>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {tabs.map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              tab === id
                ? "bg-[var(--accent-green)] text-white"
                : "border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-primary)]"
            }`}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {tab !== "users" && statsLoading && !stats ? (
        <div className="grid min-h-40 place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-green)]" aria-label={t("common.loading")} />
        </div>
      ) : null}
      {tab !== "users" && statsError ? (
        <ErrorNote onRetry={loadStats} retryLabel={t("admin.retry")}>
          {statsError}
        </ErrorNote>
      ) : null}

      {tab === "overview" && stats ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={t("admin.cards.users")} value={stats.totalUsers} />
            <StatCard label={t("admin.cards.requests")} value={totals.requests} />
            <StatCard label={t("admin.cards.guestRequests")} value={totals.guests} />
          </div>
          <Panel title={t("admin.newUsers")}>
            {(stats.newUsers || []).every((row) => !row.count) ? (
              <Status>{t("admin.empty")}</Status>
            ) : (
              <DailyChart data={stats.newUsers} bars={["count"]} t={t} />
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title={t("admin.goals")}>
              <RankList
                empty={t("admin.empty")}
                items={(stats.goals || []).map((item) => ({
                  name: t(`admin.goalsMap.${item.goal}`),
                  count: item.count,
                }))}
              />
            </Panel>
            <Panel title={t("admin.bmi")}>
              <RankList
                empty={t("admin.empty")}
                items={(stats.bmiCategories || []).map((item) => ({
                  name: t(`admin.bmiMap.${item.category}`) === `admin.bmiMap.${item.category}`
                    ? item.category
                    : t(`admin.bmiMap.${item.category}`),
                  count: item.count,
                }))}
              />
            </Panel>
            <Panel title={t("admin.allergies")}>
              <RankList items={stats.topAllergies} empty={t("admin.empty")} />
            </Panel>
            <Panel title={t("admin.foods")}>
              <RankList items={stats.topFoods} empty={t("admin.empty")} />
            </Panel>
          </div>
          <Panel title={t("admin.language")}>
            {stats.language?.available ? (
              <RankList
                empty={t("admin.empty")}
                items={stats.language.counts.map((item) => ({
                  name: item.language === "ar" ? t("language.arabic") : t("language.english"),
                  count: item.count,
                }))}
              />
            ) : (
              <Status>{t("admin.languageUnavailable")}</Status>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "usage" && stats ? (
        <div className="space-y-4">
          <Panel title={t("admin.usageByFeature")}>
            {totals.requests === 0 ? (
              <Status>{t("admin.empty")}</Status>
            ) : (
              <DailyChart data={stats.aiUsage} bars={FEATURES} t={t} />
            )}
          </Panel>
          <Panel title={t("admin.usageByAudience")}>
            {totals.requests === 0 ? (
              <Status>{t("admin.empty")}</Status>
            ) : (
              <DailyChart data={stats.aiUsage} bars={["guest", "registered"]} t={t} />
            )}
          </Panel>
        </div>
      ) : null}

      {tab === "users" ? (
        <div className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setSubmittedQuery(query.trim());
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("admin.searchPlaceholder")}
              className={fieldClass()}
              maxLength={100}
            />
            <button
              type="submit"
              className="rounded-xl bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white"
            >
              {t("admin.search")}
            </button>
          </form>
          {usersLoading && !users ? (
            <div className="grid min-h-40 place-items-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--accent-green)]" aria-label={t("common.loading")} />
            </div>
          ) : null}
          {usersError ? (
            <ErrorNote onRetry={loadUsers} retryLabel={t("admin.retry")}>
              {usersError}
            </ErrorNote>
          ) : null}
          {users && users.users.length === 0 ? <Status>{t("admin.noUsers")}</Status> : null}
          {users && users.users.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
              <table className="min-w-[760px] w-full text-left text-sm rtl:text-right">
                <thead className="text-xs text-[var(--text-secondary)]">
                  <tr>
                    {["email", "name", "created", "lastSignIn", "food", "bmi"].map((key) => (
                      <th key={key} className="px-3 py-3 font-medium">
                        {t(`admin.columns.${key}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.users.map((user) => (
                    <tr key={user.id} className="border-t border-[var(--border)]">
                      <td className="px-3 py-3">{user.email || "—"}</td>
                      <td className="px-3 py-3">{user.name || "—"}</td>
                      <td className="px-3 py-3">{formatWhen(user.createdAt, lang)}</td>
                      <td className="px-3 py-3">{formatWhen(user.lastSignInAt, lang)}</td>
                      <td className="px-3 py-3 tabular-nums">{user.foodCount}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="tabular-nums">{user.bmiCount}</span>
                          <button
                            type="button"
                            onClick={() => openUser(user.id)}
                            className="font-medium text-[var(--accent-green)]"
                          >
                            {t("admin.view")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {users && users.total > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 text-sm">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-xl border border-[var(--border)] px-3 py-2 disabled:opacity-40"
              >
                {t("admin.previous")}
              </button>
              <span className="text-[var(--text-secondary)]">
                {t("admin.page", { page, pages: Math.ceil(users.total / PAGE_SIZE) })}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(users.total / PAGE_SIZE)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-xl border border-[var(--border)] px-3 py-2 disabled:opacity-40"
              >
                {t("admin.next")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-title"
            className="max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 text-[var(--text-primary)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="admin-user-title" className="text-lg font-bold">
                  {selected.user?.name || selected.user?.email || t("admin.user")}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">{selected.user?.email}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-sm text-[var(--text-secondary)]">
                {t("admin.close")}
              </button>
            </div>
            {detailLoading ? (
              <div className="grid min-h-24 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--accent-green)]" aria-label={t("common.loading")} />
              </div>
            ) : (
              <div className="space-y-4">
                {actionError ? <ErrorNote>{actionError}</ErrorNote> : null}
                {editing ? (
                  <form className="grid gap-3 sm:grid-cols-2" onSubmit={saveProfile}>
                    <label className="text-sm sm:col-span-2">
                      {t("admin.fields.name")}
                      <input
                        className={`${fieldClass()} mt-1`}
                        value={form.full_name}
                        onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                      />
                    </label>
                    <label className="text-sm">
                      {t("admin.fields.age")}
                      <input
                        className={`${fieldClass()} mt-1`}
                        inputMode="numeric"
                        value={form.age}
                        onChange={(event) => setForm({ ...form, age: event.target.value })}
                      />
                    </label>
                    <label className="text-sm">
                      {t("admin.fields.sex")}
                      <select
                        className={`${fieldClass()} mt-1`}
                        value={form.sex}
                        onChange={(event) => setForm({ ...form, sex: event.target.value })}
                      >
                        <option value="">{t("admin.unset")}</option>
                        <option value="male">{t("admin.sex.male")}</option>
                        <option value="female">{t("admin.sex.female")}</option>
                      </select>
                    </label>
                    <label className="text-sm">
                      {t("admin.fields.height")}
                      <input
                        className={`${fieldClass()} mt-1`}
                        inputMode="decimal"
                        value={form.height_cm}
                        onChange={(event) => setForm({ ...form, height_cm: event.target.value })}
                      />
                    </label>
                    <label className="text-sm">
                      {t("admin.fields.weight")}
                      <input
                        className={`${fieldClass()} mt-1`}
                        inputMode="decimal"
                        value={form.weight_kg}
                        onChange={(event) => setForm({ ...form, weight_kg: event.target.value })}
                      />
                    </label>
                    <label className="text-sm">
                      {t("admin.fields.activity")}
                      <select
                        className={`${fieldClass()} mt-1`}
                        value={form.activity_level}
                        onChange={(event) => setForm({ ...form, activity_level: event.target.value })}
                      >
                        <option value="">{t("admin.unset")}</option>
                        {["sedentary", "light", "moderate", "very", "extra"].map((id) => (
                          <option key={id} value={id}>
                            {t(`bmi.activity${id[0].toUpperCase()}${id.slice(1)}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      {t("admin.fields.goal")}
                      <select
                        className={`${fieldClass()} mt-1`}
                        value={form.goal}
                        onChange={(event) => setForm({ ...form, goal: event.target.value })}
                      >
                        <option value="">{t("admin.unset")}</option>
                        <option value="loss">{t("bmi.goalLoss")}</option>
                        <option value="maintain">{t("bmi.goalMaintain")}</option>
                        <option value="gain">{t("bmi.goalGain")}</option>
                      </select>
                    </label>
                    <label className="text-sm sm:col-span-2">
                      {t("admin.fields.allergies")}
                      <textarea
                        className={`${fieldClass()} mt-1 min-h-24`}
                        value={form.allergies}
                        onChange={(event) => setForm({ ...form, allergies: event.target.value })}
                      />
                    </label>
                    <div className="flex gap-2 sm:col-span-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-[var(--accent-green)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {t("admin.save")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(false)}
                        className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                      >
                        {t("admin.cancel")}
                      </button>
                    </div>
                  </form>
                ) : (
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    {[
                      ["name", selected.profile?.full_name],
                      ["age", selected.profile?.age],
                      ["sex", selected.profile?.sex ? t(`admin.sex.${selected.profile.sex}`) : ""],
                      ["height", selected.profile?.height_cm],
                      ["weight", selected.profile?.weight_kg],
                      ["goal", selected.profile?.goal ? t(`admin.goalsMap.${selected.profile.goal}`) : ""],
                    ].map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-[var(--text-secondary)]">{t(`admin.fields.${key}`)}</dt>
                        <dd>{value || "—"}</dd>
                      </div>
                    ))}
                    <div className="sm:col-span-2">
                      <dt className="text-[var(--text-secondary)]">{t("admin.fields.allergies")}</dt>
                      <dd>{selected.profile?.allergies?.length ? selected.profile.allergies.join(lang === "ar" ? "، " : ", ") : "—"}</dd>
                    </div>
                  </dl>
                )}
                <RecordList
                  title={t("admin.records.food")}
                  empty={t("admin.empty")}
                  rows={(selected.foodLog || []).map((row) => `${row.food_name || "—"} · ${row.calories ?? 0}`)}
                />
                <RecordList
                  title={t("admin.records.bmi")}
                  empty={t("admin.empty")}
                  rows={(selected.bmiHistory || []).map((row) => `${row.bmi ?? "—"} · ${row.category || "—"}`)}
                />
                <RecordList
                  title={t("admin.records.daily")}
                  empty={t("admin.empty")}
                  rows={(selected.dailyLog || []).map((row) => `${row.food_name || "—"} · ${row.calories ?? 0}`)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm(formFromProfile(selected.profile));
                      setEditing(true);
                    }}
                    className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                  >
                    {t("admin.edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm("data")}
                    className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-600 dark:text-red-300"
                  >
                    {t("admin.deleteData")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirm("account")}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm text-white"
                  >
                    {t("admin.deleteAccount")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {confirm ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5"
          >
            <h2 className="text-lg font-bold">{t(confirm === "account" ? "admin.confirmAccount" : "admin.confirmData")}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {selected?.user?.email || selected?.user?.name}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={runDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {t("admin.confirm")}
              </button>
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              >
                {t("admin.cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RecordList({ title, rows, empty }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length ? (
        <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
          {rows.map((row, index) => (
            <li key={`${row}-${index}`}>{row}</li>
          ))}
        </ul>
      ) : (
        <Status>{empty}</Status>
      )}
    </section>
  );
}
