// The domain: an exchange of live AI-run conversations that an operator watches.

export type LineStatus =
  | "thinking" // AI is composing a reply
  | "replying" // AI is streaming a reply right now
  | "waiting" // AI has handed off and is holding for a human
  | "idle" // open, quiet, AI in control
  | "resolved"; // closed out

export type Channel = "voice" | "web" | "sms";

export type Speaker = "ai" | "caller" | "operator" | "system";

export interface Message {
  id: string;
  speaker: Speaker;
  text: string;
  at: number; // epoch ms
  partial?: boolean; // still streaming
}

export interface Line {
  id: string; // e.g. L-2048
  caller: string;
  channel: Channel;
  topic: string;
  status: LineStatus;
  heldByHuman: boolean; // an operator took the line
  confidence: number; // 0..1 the AI's self-reported confidence
  startedAt: number;
  lastAt: number; // last activity
  messages: Message[];
  waitingReason?: string; // why the AI handed off
}

export interface Summary {
  open: number; // not resolved
  thinking: number;
  replying: number;
  waiting: number; // need a human
  resolvedToday: number;
  avgConfidence: number;
}

export type Connection = "booting" | "live" | "dropped" | "reconnecting";
