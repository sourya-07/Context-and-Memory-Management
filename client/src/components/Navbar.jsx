import { Link, useLocation } from "react-router-dom"

// The main navigation links shown across the top of every page
const NAV_LINKS = [
  { path: "/", label: "Dashboard" },
  { path: "/create", label: "Create Invoice" },
  { path: "/suppliers", label: "Suppliers" },
  { path: "/log-event", label: "Log Event" },
]

function Navbar() {
  const currentLocation = useLocation()

  return (
    <nav style={{
      background: "var(--bg-card)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "0 2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
      }}>

        {/* ── Logo ─────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {/* Small coloured dot inside a rounded square */}
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: "linear-gradient(135deg, var(--color-teal), var(--color-yellow))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: "var(--color-navy)" }} />
          </div>

          <div>
            <div style={{
              fontWeight: 800,
              fontSize: "0.95rem",
              color: "var(--color-navy)",
              lineHeight: 1,
            }}>
              ContextAI
            </div>
            <div style={{
              fontSize: "0.6rem",
              color: "var(--text-muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              Memory Management
            </div>
          </div>
        </div>

        {/* ── Navigation links ─────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.25rem" }}>
          {NAV_LINKS.map(link => {
            const isActive = currentLocation.pathname === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  padding: "0.45rem 0.9rem",
                  borderRadius: 8,
                  fontSize: "0.85rem",
                  fontWeight: isActive ? 700 : 500,
                  textDecoration: "none",
                  // Active link looks slightly highlighted; inactive is muted
                  color: isActive ? "var(--color-navy)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-base)" : "transparent",
                  border: isActive ? "1px solid var(--border)" : "1px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

export default Navbar