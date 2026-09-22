import { useState } from "react";
import { HERO_VIDEO } from "./heroVideo";

export default function HeroVideoPreview() {
  const [videoState, setVideoState] = useState("loading");

  return (
    <figure className="hero-video-frame">
      <figcaption className="hero-video-plate">Recorded product walkthrough</figcaption>

      <div className="hero-video-stage">
        <video
          className={videoState === "ready" ? "is-ready" : ""}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          src={HERO_VIDEO.src}
          onCanPlay={() => setVideoState("ready")}
          onError={() => setVideoState("error")}
          aria-label="Recorded LINKO product walkthrough"
        >
          Your browser does not support embedded video.
        </video>

        {videoState !== "ready" && (
          <div className="hero-video-placeholder" role="status">
            <strong>
              {videoState === "error"
                ? "The walkthrough video could not load."
                : "The walkthrough video is loading."}
            </strong>
            <p>The chapters under this frame still name what the recording shows.</p>
          </div>
        )}
      </div>

      <ol className="hero-video-chapters" aria-label="Product walkthrough chapters">
        {HERO_VIDEO.chapters.map((chapter) => (
          <li key={chapter}>{chapter}</li>
        ))}
      </ol>
    </figure>
  );
}
