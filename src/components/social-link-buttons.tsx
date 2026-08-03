import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { FALLBACK_SOCIAL_LINKS, loadSocialLinks, socialStyle, type SocialLink } from "@/lib/social-links";

/**
 * Renders assistant text, turning link tokens into branded buttons.
 *
 * Tokens the model may emit:
 *   [[links]]            → every official link
 *   [[link:instagram]]   → one specific link
 */

function LinkButtons({ links }: { links: SocialLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="my-2 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          title={l.description || l.label}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${socialStyle(l.key)}`}
        >
          <span aria-hidden>{l.emoji}</span>
          {l.label}
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      ))}
    </div>
  );
}

export function AssistantText({ text }: { text: string }) {
  const [links, setLinks] = useState<SocialLink[]>(FALLBACK_SOCIAL_LINKS);

  useEffect(() => {
    let alive = true;
    void loadSocialLinks().then((l) => {
      if (alive) setLinks(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  const parts = text.split(/(\[\[links\]\]|\[\[link:[a-z0-9_-]+\]\]|\bhttps?:\/\/\S+)/gi);

  return (
    <>
      {parts.map((part, i) => {
        if (/^\[\[links\]\]$/i.test(part)) return <LinkButtons key={i} links={links} />;
        const one = /^\[\[link:([a-z0-9_-]+)\]\]$/i.exec(part);
        if (one) {
          const found = links.filter((l) => l.key === one[1]!.toLowerCase());
          return <LinkButtons key={i} links={found} />;
        }
        if (/^https?:\/\//i.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noreferrer" className="underline">
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

/** Standalone hub of every official link, for pages and the chat welcome card. */
export function SocialLinkHub({ className = "" }: { className?: string }) {
  const [links, setLinks] = useState<SocialLink[]>(FALLBACK_SOCIAL_LINKS);
  useEffect(() => {
    let alive = true;
    void loadSocialLinks().then((l) => {
      if (alive) setLinks(l);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <div className={className}>
      <LinkButtons links={links} />
    </div>
  );
}
