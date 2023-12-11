import { AskMessage, Messages, ReplyMessage, TellMessage } from "./protocol";
import { Future } from "../utils";
import { AnyTransition } from "./transition";
import { AnyOutput } from "./output";
import { Conn } from "../connections";
import { Capacity } from "./capacity";

export class Actor<
  State extends string,
  Transition extends AnyTransition<State>,
  Output extends AnyOutput
> {
  protected thingId: string;
  protected state: State;
  protected transitions = new Map<State, Transition[]>();
  protected globalTransitions = new Array<Transition>();

  private conn: Conn;
  private listener: (msg: string) => void;
  private futureStore = new Map<string, Future<any>>();

  constructor(thingId: string, conn: Conn, defaultState: State) {
    this.thingId = thingId;
    this.conn = conn;
    this.state = defaultState;
    this.listener = msg => {
      try {
        const message = Messages.validate(msg);
        if (Messages.isReply(message)) {
          if (this.futureStore.has(message.replyTo)) {
            this.futureStore.get(message.replyTo)?.resolve(message);
            this.futureStore.delete(message.replyTo);
          }
          return;
        }

        if (message.to != this.thingId) {
          return;
        }
        this.state = this.handleMessage(message);
      } catch (err) {
        console.log(`Error parsing message: ${err}`);
      }
    };
  }

  start(): void {
    this.conn.onOpen(() => {
      this.onStart().then(() => this.conn.onMessage(this.listener));
    });
  }

  stop(): void {
    this.conn.close();
  }

  send<P>(msg: TellMessage<P> | AskMessage<P> | ReplyMessage<P>): void {
    this.conn.send(
      JSON.stringify({
        from: this.thingId,
        ...msg
      })
    );
  }

  tell(msg: Output): void {
    this.send({
      to: msg.to,
      topic: msg.topic,
      payload: msg.payload
    });
  }

  ask<R>(msg: Output, timeout?: number, corrId?: string): Promise<R> {
    // Using ask is not recommended, since we can't guarantee the type of the
    // response in compile time. Also, it's not possible to check the response
    // type when replying to ask messages from other actors.
    // const ask = new MessageBuilder()
    //   .withDevice(msg.to)
    //   .withTopic(msg.topic)
    //   .withContentType("application/json")
    //   .withPayload(msg.payload)
    //   .withCorrId(corrId ?? genCorrId())
    //   .build();
    const ask = Messages.ask(msg, corrId);
    const promise = new Promise<R>((resolve, reject) => {
      this.futureStore.set(ask.replyTo, new Future(resolve, reject, timeout));
    });
    this.send(ask);
    return promise;
  }

  respond<P, R>(msg: AskMessage<P>, payload: R, status?: number): void {
    // Responding to ask messages is not recommended, either.
    const resp = Messages.reply(msg, payload, status);
    this.send(resp);
  }

  protected handleMessage(msg: TellMessage<any> | AskMessage<any>): State {
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

  protected handleUnknownMessage(
    msg: TellMessage<any> | AskMessage<any>
  ): State {
    this.onUnknown(msg);
    return this.state;
  }

  protected async onStart(): Promise<void> {}

  protected onReceive(_: TellMessage<any> | AskMessage<any>): void {}

  protected onUnknown(msg: TellMessage<any> | AskMessage<any>): void {
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

  call<P, R>(capacity: Capacity<P, R>, payload: P): Promise<R> {
    return capacity.handle(payload);
  }
}
