export interface Item {
  id: number;
  url: string;
  title: string | null;
  selection: string | null;
  excerpt: string | null;
  created_at: string;
  summary: string | null;
  tags: string[];
  topic: string | null;
  status: "pending" | "enriched" | "error";
  error: string | null;
  transcript: string | null;
  score?: number;
}
