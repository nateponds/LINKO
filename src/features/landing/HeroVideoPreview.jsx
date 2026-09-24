import { useEffect, useRef, useState } from "react";
import { HERO_VIDEO } from "./heroVideo";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export default function HeroVideoPreview() {
  const [videoStatus, setVideoStatus] = useState("loading");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  const videoRef = useRef(null);

  useEffect(() => {
    const motionPreference = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => {
      setPrefersReducedMotion(motionPreference.matches);
      if (motionPreference.matches) videoRef.current?.pause();
    };

    motionPreference.addEventListener("change", updatePreference);
    return () => motionPreference.removeEventListener("change", updatePreference);
  }, []);

  return (
    <div className="hero-video">
      <div className="hero-video-frame">
        <video
          ref={videoRef}
          className={videoStatus === "ready" ? "is-ready" : ""}
          autoPlay={!prefersReducedMotion}
          loop={!prefersReducedMotion}
          controls
          muted
          playsInline
          preload="metadata"
          src={HERO_VIDEO.src}
          onCanPlay={() => setVideoStatus("ready")}
          onError={() => setVideoStatus("error")}
          aria-label="Recorded LINKO product walkthrough"
        >
          Your browser does not support embedded video.
        </video>

        {videoStatus !== "ready" && (
          <div
            className="hero-video-placeholder"
            role={videoStatus === "error" ? "alert" : "status"}
          >
            <p>Product tour</p>
            <p>
              {videoStatus === "error"
                ? "The product tour could not be loaded. Refresh the page to try again, or follow the workflow steps below."
                : "Loading the product tour…"}
            </p>
          </div>
        )}
      </div>

      <ul className="hero-video-chapters" aria-label="Product walkthrough chapters">
        {HERO_VIDEO.chapters.map((chapter) => (
          <li key={chapter}>{chapter}</li>
        ))}
      </ul>
    </div>
  );
}
