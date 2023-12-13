export interface Conn {
  start(): Promise<void>;
  send(msg: string): Promise<void>;
  close(): Promise<void>;

  onMessage(cb: (msg: string) => void): void;
}
