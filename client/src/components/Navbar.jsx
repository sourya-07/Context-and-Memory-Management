import { Link } from "react-router-dom"

function Navbar() {
  return (
    <nav style={styles.nav}>
      <h2>Context AI Dashboard</h2>
      <div>
        <Link to="/" style={styles.link}>Dashboard</Link>
        <Link to="/create" style={styles.link}>Create Invoice</Link>
      </div>
    </nav>
  )
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    padding: "1rem 2rem",
    background: "#111",
    color: "white"
  },
  link: {
    marginLeft: "1rem",
    color: "white",
    textDecoration: "none"
  }
}

export default Navbar