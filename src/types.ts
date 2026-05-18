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

export interface CheckRequest {
  portal: string;
  combo: string[]; // Format "user:pass"
  threads: number;
  proxies: string[];
  bypassCloudflare: boolean;
  randomUserAgent: boolean;
}
