import { RawData, WebSocket } from "ws";
import async from "async";

import { AnyMessage, DittoHeaders, Message, MessageBuilder } from "./protocol";
import { Future, genCorrId } from "../utils";
import { AnyTransition } from "./transition";
import { AnyOutput } from "./output";

export class Actor<
  State extends string,
  Transition extends AnyTransition<State>,
  Output extends AnyOutput
> {
  protected thingId: string;
  protected conn: WebSocket;
  protected queue: async.QueueObject<AnyMessage>;
  protected state: State;
  protected transitions = new Map<State, Transition[]>();
  protected globalTransitions = new Array<Transition>();
  protected listener: (data: RawData, isBinary: boolean) => void;
  private futureStore = new Map<string, Future<any>>();

  constructor(thingId: string, conn: WebSocket, defaultState: State) {
    this.thingId = thingId;
    this.conn = conn;
    this.queue = async.queue((msg, done) => {
      if (msg.to != this.thingId) {
        return;
      }
      this.state = this.handleMessage(msg);
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
          if (message.to != this.thingId) {
            return;
          }
          this.state = this.handleMessage(message);
        }
      } catch (err) {
        console.log(`Error parsing message: ${err}`);
      }
    };
  }

  start(): void {
    this.conn.once("open", () => {
      this.onStart().then(() => this.conn.on("message", this.listener));
    });
  }

  stop(): void {
    this.conn.removeListener("message", this.listener);
    this.queue.kill();
  }

  send(msg: DittoHeaders): void {
    this.conn.send(JSON.stringify(msg));
  }

  tell(msg: Output): void {
    const tell = new MessageBuilder()
      .withDevice(msg.to)
      .withMessageName(msg.topic)
      .withContentType("application/json")
      .withPayload(msg.payload)
      .json();

    this.send(tell);
  }

  ask<R>(msg: Output, timeout?: number, corrId?: string): Promise<R> {
    // Using ask is not recommended, since we can't guarantee the type of the
    // response in compile time. Also, it's not possible to check the response
    // type when replying to ask messages from other actors.
    const ask = new MessageBuilder()
      .withDevice(msg.to)
      .withMessageName(msg.topic)
      .withContentType("application/json")
      .withPayload(msg.payload)
      .withCorrId(corrId ?? genCorrId())
      .build();

    const promise = new Promise<R>((resolve, reject) => {
      if (!ask.corrId) {
        reject(new Error("Ask messages must have a correlation ID"));
      } else {
        this.futureStore.set(ask.corrId, new Future(resolve, reject, timeout));
      }
    });
    this.send(ask);
    return promise;
  }

  respond<R>(msg: AnyMessage, payload: R, status?: number): void {
    // Responding to ask messages is not recommended, either.
    const resp = msg.respond(payload, status);
    this.send(resp);
  }

  protected handleMessage(msg: AnyMessage): State {
    this.onReceive(msg);
    const transitions = this.transitions.get(this.state) ?? [];
    for (const transition of [...transitions, ...this.globalTransitions]) {
      if (transition.accept(msg)) {
        transition.handle(msg);
        return transition.to ?? this.state;
      }
    }
    return this.handleUnknownMessage(msg);
  }

  protected handleUnknownMessage(msg: AnyMessage): State {
    this.onUnknown(msg);
    return this.state;
  }

  protected async onStart(): Promise<void> {}

  protected onReceive(_: AnyMessage): void {}

  protected onUnknown(msg: AnyMessage): void {
    console.log(`Received unknown message: ${msg.topic}`);
  }

  addTransition(transition: Transition) {
    if (!transition.from) {
      this.globalTransitions.push(transition);
      return;
    }

    if (!this.transitions.has(transition.from)) {
      this.transitions.set(transition.from, []);
    }
    this.transitions.get(transition.from)!.push(transition);
  }

  addTransitions(...transitions: Transition[]) {
    for (const transition of transitions) {
      this.addTransition(transition);
    }
  }
}
