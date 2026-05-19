export interface HitResult {
  username: string;
  password: string;
  created?: string;
  expiry?: string;
  daysLeft?: number;
  activeCons?: string;
  maxCons?: string;
  status?: string;
  liveCount?: number;
  vodCount?: number;
  seriesCount?: number;
  timezone?: string;
  m3uLink?: string;
}

export interface ProgressState {
  processed: number;
  total: number;
  hits: number;
  bad: number;
  cpm: number;
  percent: number;
  proxyErrors?: number;
}

export type ProxyType = "http" | "socks4" | "socks5" | "none";

export interface CheckRequest {
  portal: string;
  combo: string[]; // Format "user:pass"
  threads: number;
  proxies: string[];
  proxyType: ProxyType;
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
}

export interface FinishedPayload {
  hits: number;
  bad: number;
  proxyErrors: number;
  aborted?: boolean;
  error?: string;
}
