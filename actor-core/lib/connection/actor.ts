import { RawData, WebSocket } from "ws";
import async from "async";

import { DittoProtocol, Message } from "./messages";
import { Future } from "../utils";

export abstract class Actor<S extends string> {
  protected thingId: string;
  protected conn: WebSocket;
  protected queue: async.QueueObject<Message>;
  protected state: S;
  protected listener: (data: RawData, isBinary: boolean) => void;
  private futureStore = new Map<string, Future<any>>();

  constructor(thingId: string, conn: WebSocket, defaultState: S) {
    this.thingId = thingId;
    this.conn = conn;
    this.queue = async.queue((msg, done) => {
      console.log("ACK");
      const [thingId, topic] = msg.extractTopic();
      if (thingId != this.thingId) {
        return;
      }
      this.state = this.handleMessage(topic, msg);
      done();
    }, 1);

    this.state = defaultState;
    this.listener = (rawData, isBinary) => {
      if (isBinary) {
        return;
      }
      try {
        const rawMessage = JSON.parse(rawData.toString("utf-8"));
        const message = new Message(rawMessage);
        if (message.corrId && this.futureStore.has(message.corrId)) {
          this.futureStore.get(message.corrId)?.resolve(message);
          this.futureStore.delete(message.corrId);
        } else {
          // TODO use event queue
          // this.queue.push(message);
          const [thingId, topic] = message.extractTopic();
          if (thingId != this.thingId) {
            return;
          }
          this.state = this.handleMessage(topic, message);
        }
      } catch (err) {
        console.log(`Error parsing message: ${err}`);
      }
    };
  }

  start(): void {
    this.onStart();
    this.conn.on("message", this.listener);
  }

  stop(): void {
    this.conn.removeListener("message", this.listener);
    this.queue.kill();
  }

  tell<T>(msg: DittoProtocol<T>): void {
    this.conn.send(JSON.stringify(msg));
  }

  ask<R, T = any>(msg: Message<T>, timeout?: number): Promise<R> {
    const promise = new Promise<R>((resolve, reject) => {
      if (!msg.corrId) {
        reject(new Error("Ask messages must have a correlation ID"));
      } else {
        this.futureStore.set(msg.corrId, new Future(resolve, reject, timeout));
      }
    });
    this.tell(msg);
    return promise;
  }

  protected abstract handleMessage(topic: string, msg: Message): S;

  protected handleUnknownMessage(msg: Message): S {
    console.log(`Received unknown message: ${msg.topic}`);
    return this.state;
  }

  protected onStart(): void {}
}
