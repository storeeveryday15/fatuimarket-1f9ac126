import { useEffect, useRef } from "react";

export function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.querySelector("script[data-adsterra]")) return;

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.setAttribute("data-adsterra", "true");
    script.src =
      "https://pl30219564.effectivecpmnetwork.com/51b975244a9a31c25b625cf0cb9f049d/invoke.js";
    containerRef.current.appendChild(script);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full flex justify-center px-4 py-6"
      aria-hidden="true"
    >
      <div id="container-51b975244a9a31c25b625cf0cb9f049d" className="max-w-full overflow-hidden" />
    </div>
  );
}
