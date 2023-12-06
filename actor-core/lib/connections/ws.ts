import { WebSocket } from "ws";
import { Conn } from "./base";

export class WebsocketConn implements Conn {
  ws: WebSocket;

  constructor(url: string) {
    this.ws = new WebSocket(url);

    this.onError(err => {
      console.log(`Failed to connect: ${err}`);
    });

    this.onOpen(() => {
      console.log(`Successfully connected to ${this.url}`);
    });

    this.onClose(reason => {
      console.log(`Connection closed: ${reason.toString()}`);
    });
  }

  onOpen(cb: () => void): void {
    this.ws.on("open", cb);
  }

  onMessage(cb: (msg: string) => void): void {
    this.ws.on("message", (data, isBinary) => {
      if (isBinary) {
        return;
      }
      const parsed = data.toString("utf-8");
      cb(parsed);
    });
  }

  onError(cb: (err: Error) => void): void {
    this.ws.once("error", cb);
  }

  onClose(cb: (reason: string) => void): void {
    this.ws.once("close", (code, reason) => {
      const parsed = `Code: ${code}, Reason: ${reason.toString()}`;
      cb(parsed);
    });
  }

  send(msg: string): void {
    this.ws.send(msg);
  }

  close(): void {
    this.ws.close();
  }

  get url(): string {
    return this.ws.url;
  }
}
