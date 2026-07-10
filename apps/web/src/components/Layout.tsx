import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSelectedCompetition } from "../lib/competitionContext";
import { useCompetitions } from "../hooks";
import { Icon, Select } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "لوحة المعلومات", icon: "dashboard", end: true },
  { to: "/candidates", label: "المشاركون", icon: "groups" },
  { to: "/judges", label: "المحكّمون", icon: "gavel" },
  { to: "/results", label: "النتائج", icon: "leaderboard" },
  { to: "/settings", label: "إعدادات التقييم", icon: "tune" },
];

function CompetitionSwitcher() {
  const { data, isLoading } = useCompetitions();
  const { selectedId, setSelectedId } = useSelectedCompetition();

  // Default to the first competition once loaded and nothing is chosen.
  const value =
    selectedId ?? (data && data.length > 0 ? data[0].id : "") ?? "";

  return (
    <div className="px-4 pb-4">
      <label className="mb-1.5 block font-label-md text-xs text-on-primary-container/70">
        المسابقة الحالية
      </label>
      <Select
        value={value}
        disabled={isLoading || !data || data.length === 0}
        onChange={(e) => setSelectedId(e.target.value || null)}
        className="w-full bg-surface-container-lowest"
      >
        {(!data || data.length === 0) && <option value="">لا توجد مسابقات</option>}
        {data?.map((competition) => (
          <option key={competition.id} value={competition.id}>
            {competition.name}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 flex h-screen w-64 flex-col border-s border-outline-variant bg-primary text-on-primary">
        <div className="flex items-center gap-3 px-6 py-6">
          <img
            src="/logo-omar.png"
            alt="شعار جمعية عمر بن الخطاب"
            className="h-11 w-11 shrink-0 rounded-full bg-white object-cover"
          />
          <div>
            <p className="font-headline-md text-lg leading-tight">لوحة التحكيم</p>
            <p className="font-body-md text-xs text-on-primary-container/70">
              عمر بن الخطاب
            </p>
          </div>
        </div>

        <CompetitionSwitcher />

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-full px-4 py-2.5 font-label-md text-sm transition-colors",
                  isActive
                    ? "bg-on-primary-container/20 font-medium text-on-primary"
                    : "text-on-primary-container/80 hover:bg-on-primary-container/10",
                ].join(" ")
              }
            >
              <Icon name={item.icon} className="text-[22px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-on-primary-container/20 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-on-primary-container/20">
              <Icon name="person" className="text-[20px]" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-body-md text-sm">{user?.name}</p>
              <p className="font-body-md text-xs text-on-primary-container/70">
                مشرف
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-full px-4 py-2 font-label-md text-sm text-on-primary-container/80 hover:bg-on-primary-container/10"
          >
            <Icon name="logout" className="text-[20px]" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-container-padding py-margin-lg dotted-bg">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
