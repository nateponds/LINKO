import { PackageCheck } from "lucide-react";

/** A packaging illustration shared by the sign-in and registration screens. */
export default function AuthVisualPanel() {
  return (
    <aside className="auth-visual-panel">
      <div className="auth-visual-top"><PackageCheck size={20} /><span>Business, connected.</span></div>
      <div className="auth-visual-body">
        <h2 className="auth-visual-heading">Good stock.<br />Good business.</h2>
        <p className="auth-visual-description">Find your next wholesale partner. Keep every order moving.</p>
        <svg className="auth-parcels" viewBox="0 0 500 310" fill="none" aria-hidden="true">
          <ellipse cx="260" cy="283" rx="206" ry="15" fill="#dce5f1" />
          <g stroke="#526b8c" strokeWidth="1.6" strokeLinejoin="round">
            <path d="M58 168L168 125L273 168L162 215Z" fill="#f7fafc" />
            <path d="M58 168V249L162 293V215Z" fill="#e4ebf4" />
            <path d="M162 215L273 168V249L162 293Z" fill="#ccd9eb" />
            <path d="M109 148L216 192V229L194 239V202L86 158" fill="#accb83" />
            <path d="M229 101L341 55L449 100L337 148Z" fill="#fff" />
            <path d="M229 101V236L337 282V148Z" fill="#eaf0f8" />
            <path d="M337 148L449 100V235L337 282Z" fill="#d5e1f2" />
            <path d="M284 78L391 125V167L369 177V135L262 88" fill="#315bc5" stroke="#315bc5" />
            <path d="M250 173L312 199V233L250 207Z" fill="white" stroke="none" />
            <path d="M259 189L303 208M259 195L287 207" stroke="#9babc1" />
            <path d="M363 232V214M357 223L363 214L369 218M382 224V206M376 215L382 206L388 210" />
            <path d="M155 65L213 41L270 65L212 90Z" fill="#c4dbab" />
            <path d="M155 65V121L212 146V90Z" fill="#adc993" />
            <path d="M212 90L270 65V121L212 146Z" fill="#92b674" />
            <path d="M182 54L239 79V99" />
          </g>
          <g transform="rotate(-9 87 86)"><rect x="43" y="61" width="99" height="44" rx="5" fill="#315bc5" /><text x="59" y="88" fill="white" fontSize="17" fontWeight="700" fontFamily="sans-serif">LINKO</text><circle cx="123" cy="83" r="5" fill="#accb83" /></g>
        </svg>
      </div>
      <div className="auth-visual-bottom"><span>Made for the way you do business.</span><span>&copy; {new Date().getFullYear()} LINKO</span></div>
    </aside>
  );
}
