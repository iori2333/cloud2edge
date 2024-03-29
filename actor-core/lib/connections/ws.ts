import { WebSocket } from "ws";
import { Conn } from "./base";
import async from "async";

export class WebsocketConn implements Conn {
  ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);
  }

  start(): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.ws.once("error", err => {
        this.ws.removeAllListeners("open");
        reject(err);
      });

      this.ws.once("open", () => {
        this.ws.removeAllListeners("error");
        resolve();
      });
    });

    return promise;
  }

  onMessage(cb: (msg: string) => void): void {
    const mailbox = async.queue(cb, 1);

    this.ws.on("message", (data, isBinary) => {
      if (isBinary) {
        return;
      }
      const parsed = data.toString("utf-8");
      mailbox.push(parsed);
    });
  }

  async send(msg: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws.send(msg, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    this.ws.close();
  }

  get url(): string {
    return this.ws.url;
  }
}
