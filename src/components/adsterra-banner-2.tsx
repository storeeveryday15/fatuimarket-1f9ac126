import { useEffect, useRef } from "react";

export function AdsterraBanner2() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current.querySelector("script[data-adsterra-2]")) return;

    (window as any).atOptions = {
      key: "0089853da034a9a05e3deb4b3f324f0e",
      format: "iframe",
      height: 50,
      width: 320,
      params: {},
    };

    const script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-adsterra-2", "true");
    script.src =
      "https://www.highperformanceformat.com/0089853da034a9a05e3deb4b3f324f0e/invoke.js";
    containerRef.current.appendChild(script);
  }, []);

  return (
    <div
      ref={containerRef}
      className="w-full flex justify-center px-4 py-4"
      aria-hidden="true"
    />
  );
}
