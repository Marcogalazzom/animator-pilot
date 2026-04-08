import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Info, XCircle, Bell } from "lucide-react";
import { getAlerts, markAlertAsRead, markAllAlertsAsRead } from "@/db/alerts";
import type { Alert, AlertSeverity } from "@/db/types";

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 2) return "à l'instant";
  if (diffMins < 60) return `il y a ${diffMins}min`;
  if (diffHours < 24) return `il y a ${diffHours}h`;
  if (diffDays === 0) return "aujourd'hui";
  if (diffDays === 1) return "hier";
  return `il y a ${diffDays}j`;
}

function severityColor(severity: AlertSeverity): string {
  switch (severity) {
    case "info": return "var(--color-primary)";
    case "warning": return "var(--color-warning)";
    case "critical": return "var(--color-danger)";
  }
}

function SeverityIcon({ severity }: { severity: AlertSeverity }) {
  const color = severityColor(severity);
  const size = 15;
  if (severity === "critical") return <XCircle size={size} style={{ color }} />;
  if (severity === "warning") return <AlertTriangle size={size} style={{ color }} />;
  return <Info size={size} style={{ color }} />;
}

interface AlertDropdownProps {
  onUnreadChange: (count: number) => void;
}

export default function AlertDropdown({ onUnreadChange }: AlertDropdownProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    const data = await getAlerts(undefined, 20);
    setAlerts(data);
    const unread = data.filter((a) => !a.is_read).length;
    onUnreadChange(unread);
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, []);

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  async function handleMarkAll() {
    await markAllAlertsAsRead();
    await load();
  }

  async function handleClickAlert(alert: Alert) {
    if (!alert.is_read) {
      await markAlertAsRead(alert.id);
      await load();
    }
    if (alert.link_path) {
      navigate(alert.link_path);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        width: "360px",
        maxHeight: "480px",
        backgroundColor: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "10px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        display: "flex",
        flexDirection: "column",
        zIndex: 200,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--color-border)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--color-text-primary)",
              fontFamily: "var(--font-sans)",
            }}
          >
            Notifications
          </span>
          {unreadCount > 0 && (
            <span
              style={{
                backgroundColor: "var(--color-danger)",
                color: "#fff",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 600,
                padding: "1px 6px",
                lineHeight: "16px",
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            style={{
              fontSize: "12px",
              color: "var(--color-primary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: "4px",
              fontFamily: "var(--font-sans)",
            }}
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* List */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {loading ? (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: "13px",
            }}
          >
            Chargement…
          </div>
        ) : alerts.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "var(--color-text-secondary)",
              fontSize: "13px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Bell size={28} style={{ opacity: 0.3 }} />
            <span>Aucune notification</span>
          </div>
        ) : (
          alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => handleClickAlert(alert)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px 16px",
                background: "none",
                border: "none",
                borderBottom: "1px solid var(--color-border)",
                cursor: "pointer",
                textAlign: "left",
                borderLeft: alert.is_read ? "3px solid transparent" : `3px solid var(--color-primary)`,
                transition: "background 0.12s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--color-bg)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              <div style={{ marginTop: "2px", flexShrink: 0 }}>
                <SeverityIcon severity={alert.severity} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: alert.is_read ? 400 : 600,
                    color: "var(--color-text-primary)",
                    fontFamily: "var(--font-sans)",
                    marginBottom: "2px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {alert.title}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--color-text-secondary)",
                    fontFamily: "var(--font-sans)",
                    lineHeight: "1.4",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {alert.message}
                </div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--color-text-secondary)",
                  flexShrink: 0,
                  marginTop: "2px",
                  fontFamily: "var(--font-sans)",
                }}
              >
                {timeAgo(alert.triggered_at)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
