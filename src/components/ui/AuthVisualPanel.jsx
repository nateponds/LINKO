import { Handshake, MapPin, ShieldCheck } from "lucide-react";

const HIGHLIGHTS = [
  { Icon: MapPin, text: "Wholesalers matched to your location" },
  { Icon: Handshake, text: "Direct buyer-wholesaler connections" },
  { Icon: ShieldCheck, text: "Verified supplier profiles" },
];

/** Marketing/brand side of the auth split-screen; shared by login and register. */
function AuthVisualPanel() {
  const year = new Date().getFullYear();

  return (
    <div className="auth-visual-panel">
      <div className="auth-visual-top">
        <span>Wholesale Marketplace</span>
        <span>{year}</span>
      </div>

      <div className="auth-visual-body">
        <p className="auth-visual-heading">
          The marketplace connecting MSMEs with trusted wholesalers.
        </p>

        <ul className="auth-visual-highlights">
          {HIGHLIGHTS.map(({ Icon, text }) => (
            <li key={text}>
              <Icon size={16} /> {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="auth-visual-bottom">
        <span>&copy; {year} LINKO</span>
        <span>Buyers &amp; Wholesalers</span>
      </div>
    </div>
  );
}

export default AuthVisualPanel;
