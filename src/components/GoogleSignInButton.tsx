import { useEffect, useRef, useState } from "react";

export default function GoogleSignInButton({
  clientId,
  onCredential,
  disabled = false,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scriptError, setScriptError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let intervalId: number | null = null;

    const tryRender = () => {
      const gis = window.google?.accounts?.id;
      if (!gis || !containerRef.current) return false;

      gis.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            onCredential(response.credential);
          }
        },
      });

      containerRef.current.innerHTML = "";
      gis.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        shape: "rectangular",
        text: "signin_with",
        width: 300,
      });
      return true;
    };

    if (!tryRender()) {
      let attempts = 0;
      intervalId = window.setInterval(() => {
        attempts += 1;
        if (tryRender() || attempts > 30) {
          if (intervalId) window.clearInterval(intervalId);
          if (attempts > 30) {
            setScriptError("Could not load Google Sign-In script.");
          }
        }
      }, 200);
    }

    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [clientId, onCredential]);

  if (scriptError) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
        {scriptError}
      </p>
    );
  }

  return (
    <div className={`flex justify-center ${disabled ? "pointer-events-none opacity-60" : ""}`}>
      <div ref={containerRef} />
    </div>
  );
}
