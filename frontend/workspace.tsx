"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Bell,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  ChevronDown,
  ClipboardCheck,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react";
import type { DemoAction } from "@/backend/actions";
import { navigation, title } from "@/lib/navigation";
import { SAMPLE_KEY, seed } from "@/lib/sample";
import {
  roleLabels,
  roleSchema,
  type Role,
  type State,
  type User,
} from "@/lib/types";
import Dashboard from "./dashboard";
import Rooms from "./rooms";
import StudentCampusMap from "./student-campus-map";
import {
  AuditLog,
  BookingForm,
  Bookings,
  ChangeRoom,
  Classrooms,
  Notifications,
  Reports,
  Requests,
  RequestForm,
  Reschedule,
  Timetable,
  type FeatureProps,
} from "./features";

const icons: Record<string, typeof Building2> = {
  dashboard: LayoutDashboard,
  classrooms: Building2,
  timetable: CalendarDays,
  cancellations: ClipboardCheck,
  issues: ClipboardCheck,
  rescheduling: CalendarDays,
  permissions: ShieldCheck,
  bookings: FileText,
  map: Map,
  reports: ChartNoAxesColumn,
  notifications: Bell,
  audit: History,
  rooms: Building2,
};
function validState(value: unknown): value is State {
  return (
    !!value &&
    typeof value === "object" &&
    (value as State).version === 1 &&
    [
      "rooms",
      "sessions",
      "overrides",
      "extras",
      "requests",
      "bookings",
      "notifications",
      "audit",
      "holidays",
    ].every((key) =>
      Array.isArray((value as unknown as Record<string, unknown>)[key]),
    )
  );
}
export default function Workspace({
  user,
  demo,
  view,
}: {
  user: User;
  demo: boolean;
  view: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null),
    [dark, setDark] = useState(false),
    [menu, setMenu] = useState(false),
    [switcher, setSwitcher] = useState(false),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!demo) return;
    function load() {
      try {
        const raw = localStorage.getItem(SAMPLE_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : null;
        const next = validState(parsed) ? parsed : seed();
        setState(next);
        if (!raw || !validState(parsed))
          localStorage.setItem(SAMPLE_KEY, JSON.stringify(next));
      } catch {
        setState(seed());
        setError("Your browser blocked storage. Demo changes may not persist.");
      }
    }
    load();
    setDark(localStorage.getItem("psg-fresh-theme") === "dark");
    const changed = (event: StorageEvent) => {
      if (event.key === SAMPLE_KEY) load();
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, [demo]);
  useEffect(() => {
    setMenu(false);
    setError("");
    setFeedback("");
  }, [view]);
  function save(next: State) {
    try {
      localStorage.setItem(SAMPLE_KEY, JSON.stringify(next));
      setState(next);
    } catch {
      setError(
        "Browser storage is full. Use smaller sample uploads or remove saved demo data.",
      );
    }
  }
  async function action(
    input: DemoAction,
    message = "Saved to the demo. The relevant portals have been notified.",
  ) {
    if (!state || busy) return;
    setBusy(true);
    setError("");
    setFeedback("");
    try {
      const raw = localStorage.getItem(SAMPLE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      const response = await fetch("/api/demo/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: validState(parsed) ? parsed : state,
          action: input,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      localStorage.setItem(SAMPLE_KEY, JSON.stringify(result.state));
      setState(result.state);
      setFeedback(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save this change.");
    } finally {
      setBusy(false);
    }
  }
  async function switchRole(role: Role) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          identifier: "demo",
          password: "demo",
          demo: true,
        }),
      });
      if (!response.ok) throw new Error("Unable to switch portal.");
      setSwitcher(false);
      router.push("/portal");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal switch failed.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Unable to sign out.");
      router.push("/login/" + user.role);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign out failed.");
    }
  }
  const props: FeatureProps | null = state
    ? { state, user, action, busy, save }
    : null;
  const unread =
    state?.notifications.filter(
      (n) => n.roles.includes(user.role) && !n.read.includes(user.role),
    ).length ?? 0;
  function content() {
    if (!demo)
      return (
        <section className="panel">
          <h2>Live workflow connection is pending</h2>
          <p>
            The current interactive workflows are demonstrated with sample
            records. Configure and integrate Supabase before using real campus
            records.
          </p>
        </section>
      );
    if (!props)
      return (
        <div className="empty-state">
          <Building2 />
          <h2>Loading your campus workspace…</h2>
          <p>Preparing the sample timetable and classrooms.</p>
        </div>
      );
    switch (view) {
      case "dashboard":
        return <Dashboard state={props.state} user={user} />;
      case "rooms":
        return user.role === "student"
          ? <StudentCampusMap state={props.state} />
          : <Rooms state={props.state} />;
      case "map":
        if (user.role === "student") return <StudentCampusMap state={props.state} />;
        return (
          <Rooms
            state={props.state}
            map
            image={
              user.role === "admin"
                ? async (file) => {
                    if (
                      !["image/png", "image/jpeg"].includes(file.type) ||
                      file.size > 2 * 1024 * 1024
                    ) {
                      setError("Choose a JPG or PNG up to 2 MB.");
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      save({ ...props.state, mapImage: String(reader.result) });
                    reader.onerror = () =>
                      setError("Unable to read the map image.");
                    reader.readAsDataURL(file);
                  }
                : undefined
            }
          />
        );
      case "classrooms":
        return <Classrooms {...props} />;
      case "timetable":
        return <Timetable {...props} />;
      case "cancellations":
        return <Requests {...props} kind="cancellation" />;
      case "issues":
        return <Requests {...props} kind="issue" />;
      case "permissions":
        return <Requests {...props} kind="permission" />;
      case "my-requests":
        return <Requests {...props} />;
      case "report-cancellation":
        return <RequestForm {...props} kind="cancellation" />;
      case "report-issue":
        return <RequestForm {...props} kind="issue" />;
      case "request-permission":
        return <RequestForm {...props} kind="permission" />;
      case "change-room":
        return <ChangeRoom {...props} />;
      case "rescheduling":
        return <Reschedule {...props} />;
      case "booking-request":
        return <BookingForm {...props} />;
      case "bookings":
      case "my-bookings":
      case "hod-letter":
      case "signed-letter":
        return <Bookings {...props} />;
      case "notifications":
        return <Notifications {...props} />;
      case "reports":
        return <Reports {...props} />;
      case "audit":
        return <AuditLog {...props} />;
      default:
        return <Dashboard state={props.state} user={user} />;
    }
  }
  return (
    <main className="workspace" data-theme={dark ? "dark" : "light"}>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Close menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={"sidebar " + (menu ? "open" : "")}>
        <Link href="/" className="sidebar-brand">
          <Building2 size={32} />
          <strong>
            SMART CAMPUS<small>PSG College of Technology</small>
          </strong>
        </Link>
        <div className="role-caption">
          <i />
          {roleLabels[user.role]} portal
        </div>
        <p className="sidebar-label">WORKSPACE</p>
        <nav aria-label="Portal navigation">
          {navigation[user.role].map((page) => {
            const Icon = icons[page] ?? ClipboardCheck;
            return (
              <Link
                key={page}
                href={page === "dashboard" ? "/portal" : "/portal/" + page}
                className={view === page ? "active" : ""}
                aria-current={view === page ? "page" : undefined}
              >
                <Icon size={19} />
                <span>{title(page, user.role)}</span>
                {page === "notifications" && unread > 0 && <b>{unread}</b>}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <Link href="/algorithm">
            How allocation works <ArrowIcon />
          </Link>
          <button onClick={() => void logout()}>
            <LogOut size={18} />
            Sign out
          </button>
          <small>PSG SMART CAMPUS · STUDENT PROJECT</small>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="app-header">
          <div>
            <button
              className="mobile-toggle"
              aria-label="Open menu"
              onClick={() => setMenu(true)}
            >
              <Menu />
            </button>
            <span>
              {roleLabels[user.role]}
              <i>/</i>
              <strong>{title(view, user.role)}</strong>
            </span>
          </div>
          <div className="header-controls">
            <button
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              onClick={() => {
                setDark(!dark);
                localStorage.setItem(
                  "psg-fresh-theme",
                  dark ? "light" : "dark",
                );
              }}
            >
              {dark ? <Sun size={21} /> : <Moon size={21} />}
            </button>
            <Link
              href="/portal/notifications"
              aria-label={`${unread} unread notifications`}
              className="notification-button"
            >
              <Bell size={21} />
              {unread > 0 && <i />}
            </Link>
            <div className="profile-menu">
              <button
                className="profile-button"
                aria-expanded={switcher}
                onClick={() => setSwitcher(!switcher)}
              >
                <span className="avatar">
                  {user.name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                <span>{roleLabels[user.role]}</span>
                <ChevronDown size={16} />
              </button>
              {switcher && (
                <div className="portal-switcher">
                  <strong>{demo ? "Switch demo portal" : user.name}</strong>
                  {demo &&
                    roleSchema.options.map((role) => (
                      <button
                        key={role}
                        disabled={busy}
                        onClick={() => void switchRole(role)}
                      >
                        <Users size={16} />
                        {roleLabels[role]}
                      </button>
                    ))}
                  <button onClick={() => void logout()}>
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <section className="workspace-content">
          <div className="preview-notice">
            <span>DEMO</span>Sample campus records · changes stay in this
            browser · no real room reservations or WhatsApp messages
          </div>
          <div className="page-title">
            <div>
              <h1>
                {view === "dashboard"
                  ? user.role === "admin"
                    ? "Campus overview"
                    : "Your campus workspace"
                  : title(view, user.role)}
              </h1>
              <p>
                {view === "dashboard"
                  ? "Every classroom. Every class. One connected campus."
                  : "Keep your campus spaces and day-to-day changes organized."}
              </p>
            </div>
            <span className="sample-pill">SAMPLE DATA</span>
          </div>
          {(error || feedback) && (
            <div
              className={"feedback " + (error ? "error" : "success")}
              role={error ? "alert" : "status"}
            >
              <span>{error || feedback}</span>
              <button
                aria-label="Dismiss message"
                onClick={() => {
                  setError("");
                  setFeedback("");
                }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {content()}
          <footer className="workspace-footer">
            <span>PSG Smart Campus · Fresh rebuild</span>
            <span>Fixed timetable. Flexible changes.</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
function ArrowIcon() {
  return <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />;
}
