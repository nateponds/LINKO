import { useState } from "react";
import SupportModal from "../ui/SupportModal";

function Footer() {
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <>
    <footer className="app-footer">
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} LINKO. All rights reserved.</span>
      </div>
    </footer>
    <SupportModal open={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
}

export default Footer;
