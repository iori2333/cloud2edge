export interface Conn {
  onOpen(cb: () => void): void;
  onMessage(cb: (msg: string) => void): void;
  onError(cb: (err: Error) => void): void;
  onClose(cb: (reason: string) => void): void;

  send(msg: string): Promise<void>;
  close(): Promise<void>;
}
