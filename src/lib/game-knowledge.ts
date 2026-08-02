/**
 * Public gaming knowledge map for Fatui AI.
 *
 * Used to (a) tell the model which titles it is expected to cover and
 * (b) score live web-search results as OFFICIAL vs COMMUNITY sources.
 * Contains no private or store-internal data.
 */

export type GameEntry = {
  name: string;
  aliases: string[];
  /** Domains we treat as official / first-party sources. */
  official: string[];
  /** Product slug on Fatui Market, when we sell top-ups for it. */
  slug?: string;
};

export const GAMES: GameEntry[] = [
  { name: "Mobile Legends: Bang Bang", aliases: ["mlbb", "mobile legends", "ml"], official: ["mobilelegends.com", "m.mobilelegends.com"], slug: "mobile-legends" },
  { name: "Genshin Impact", aliases: ["genshin"], official: ["genshin.hoyoverse.com", "hoyolab.com", "hoyoverse.com"], slug: "genshin-impact" },
  { name: "Wuthering Waves", aliases: ["wuwa"], official: ["wutheringwaves.kurogames.com", "kurogames.com"], slug: "wuthering-waves" },
  { name: "PUBG Mobile", aliases: ["pubgm", "pubg"], official: ["pubgmobile.com", "krafton.com"], slug: "pubg-mobile" },
  { name: "Valorant", aliases: ["val"], official: ["playvalorant.com", "riotgames.com"], slug: "valorant" },
  { name: "Honor of Kings", aliases: ["hok", "kings honor"], official: ["honorofkings.com", "levelinfinite.com"], slug: "honor-of-kings" },
  { name: "Love and Deepspace", aliases: ["lads", "l&ds"], official: ["loveanddeepspace.infoldgames.com", "infoldgames.com"], slug: "love-and-deepspace" },
  { name: "Roblox", aliases: ["robux"], official: ["roblox.com", "corp.roblox.com"], slug: "roblox" },
  { name: "Steam", aliases: ["steam wallet", "valve"], official: ["store.steampowered.com", "steamcommunity.com"], slug: "steam-wallet" },
  { name: "Free Fire", aliases: ["ff", "garena free fire"], official: ["ff.garena.com", "garena.com"], slug: "free-fire" },
  { name: "Clash of Clans", aliases: ["coc"], official: ["supercell.com", "clashofclans.com"] },
  { name: "Call of Duty: Mobile", aliases: ["codm", "cod mobile"], official: ["callofduty.com", "activision.com"] },
  { name: "Zenless Zone Zero", aliases: ["zzz"], official: ["zenless.hoyoverse.com", "hoyoverse.com", "hoyolab.com"] },
  { name: "Honkai: Star Rail", aliases: ["hsr", "star rail"], official: ["hsr.hoyoverse.com", "hoyoverse.com", "hoyolab.com"] },
  { name: "Fortnite", aliases: ["fn"], official: ["fortnite.com", "epicgames.com"] },
  { name: "Minecraft", aliases: ["mc"], official: ["minecraft.net", "mojang.com"] },
  { name: "League of Legends", aliases: ["lol"], official: ["leagueoflegends.com", "riotgames.com"] },
  { name: "Dota 2", aliases: ["dota"], official: ["dota2.com", "steampowered.com"] },
  { name: "Apex Legends", aliases: ["apex"], official: ["ea.com", "respawn.com"] },
  { name: "Overwatch 2", aliases: ["ow2", "overwatch"], official: ["overwatch.blizzard.com", "blizzard.com"] },
  { name: "EA SPORTS FC", aliases: ["ea fc", "fifa", "fc 25", "fc mobile"], official: ["ea.com", "easports.com"] },
];

/** Domains that are reliable but community-run (not first-party). */
export const TRUSTED_COMMUNITY = [
  "fandom.com",
  "gamerant.com",
  "dotesports.com",
  "pcgamesn.com",
  "eurogamer.net",
  "ign.com",
  "polygon.com",
  "gamespot.com",
  "liquipedia.net",
  "prydwen.gg",
  "op.gg",
  "u.gg",
  "mobalytics.gg",
  "reddit.com",
  "pockettactics.com",
  "sportskeeda.com",
];

const ALL_OFFICIAL = new Set(GAMES.flatMap((g) => g.official));

export function classifySource(url: string): "official" | "community" | "other" {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "other";
  }
  const match = (list: Iterable<string>) => {
    for (const d of list) if (host === d || host.endsWith(`.${d}`)) return true;
    return false;
  };
  if (match(ALL_OFFICIAL)) return "official";
  if (match(TRUSTED_COMMUNITY)) return "community";
  return "other";
}

/** Detects which supported game a free-text question is about. */
export function detectGame(text: string): GameEntry | undefined {
  const t = text.toLowerCase();
  return GAMES.find((g) => t.includes(g.name.toLowerCase()) || g.aliases.some((a) => new RegExp(`\\b${a}\\b`, "i").test(t)));
}

export const SUPPORTED_GAMES_LINE = GAMES.map((g) => g.name).join(", ");
