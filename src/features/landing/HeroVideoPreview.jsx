import { useState } from "react";
import { Check, MonitorPlay, Play } from "lucide-react";
import { HERO_VIDEO } from "./heroVideo";

export default function HeroVideoPreview() {
  const [videoReady, setVideoReady] = useState(false);

  return (
    <div className="hero-video-frame">
      <div className="hero-video-browser">
        <div className="hero-video-browser__dots" aria-hidden="true">
          <span /><span /><span />
        </div>
        <div className="hero-video-browser__address">
          <span className="hero-video-browser__lock" />
          linko.ph/product-tour
        </div>
        <span className="hero-video-browser__badge">SESSION PREVIEW</span>
      </div>

      <div className="hero-video-stage">
        <video
          className={videoReady ? "is-ready" : ""}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          src={HERO_VIDEO.src}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoReady(false)}
          aria-label="Recorded LINKO product walkthrough"
        >
          Your browser does not support embedded video.
        </video>

        {!videoReady && (
          <div className="hero-video-placeholder">
            <div className="hero-video-placeholder__grid" aria-hidden="true">
              <span /><span /><span /><span /><span /><span />
            </div>
            <div className="hero-video-placeholder__content">
              <span className="hero-video-placeholder__icon">
                <MonitorPlay size={25} />
                <i><Play size={12} fill="currentColor" /></i>
              </span>
              <small>REAL LINKO PRODUCT WALKTHROUGH</small>
              <strong>One session. The complete wholesale workflow.</strong>
              <p>Recorded session placeholder</p>
            </div>
          </div>
        )}
      </div>

      <div className="hero-video-chapters" aria-label="Product walkthrough chapters">
        {HERO_VIDEO.chapters.map((chapter, index) => (
          <span key={chapter}>
            <i><Check size={10} /></i>
            <small>0{index + 1}</small>
            {chapter}
          </span>
        ))}
      </div>
    </div>
  );
}
