import { AskMessage, Messages, ReplyMessage, TellMessage } from "./protocol";
import { Future } from "../utils";
import { AnyWrappedTransition, AnyTransition, Transitions } from "./transition";
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
  protected transitions = new Map<State, AnyWrappedTransition<State>[]>();
  protected globalTransitions: AnyWrappedTransition<State>[] = [];

  private conn: Conn;
  private listener: (msg: string) => Promise<void>;
  private futureStore = new Map<string, Future<any>>();

  constructor(thingId: string, conn: Conn, defaultState: State) {
    this.thingId = thingId;
    this.conn = conn;
    this.state = defaultState;
    this.listener = async msg => {
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
        this.state = await this.handleMessage(message);
      } catch (err) {
        console.log(`Error parsing message: ${err}`);
      }
    };
  }

  start(): void {
    this.conn.onOpen(async () => {
      await this.onStart();
      this.conn.onMessage(this.listener);
    });
  }

  stop(): void {
    this.conn.close().then(
      () => console.log("Connection closed"),
      err => console.log(`Closed connection with error: ${err.toString()}`)
    );
  }

  async send<P>(
    msg: TellMessage<P> | AskMessage<P> | ReplyMessage<P>
  ): Promise<void> {
    await this.conn.send(
      JSON.stringify({
        from: this.thingId,
        ...msg
      })
    );
  }

  async tell(msg: Output): Promise<void> {
    await this.send({
      to: msg.to,
      topic: msg.topic,
      payload: msg.payload
    });
  }

  async ask<R>(msg: Output, timeout?: number, corrId?: string): Promise<R> {
    // Using ask is not recommended, since we can't guarantee the type of the
    // response in compile time. Also, it's not possible to check the response
    // type when replying to ask messages from other actors.
    const ask = Messages.ask(msg, corrId);
    const promise = new Promise<R>((resolve, reject) => {
      this.futureStore.set(ask.replyTo, new Future(resolve, reject, timeout));
    });
    await this.send(ask);
    return await promise;
  }

  async respond<P, R>(
    msg: AskMessage<P>,
    payload: R,
    status?: number
  ): Promise<void> {
    // Responding to ask messages is not recommended, either.
    const resp = Messages.reply(msg, payload, status);
    await this.send(resp);
  }

  protected async handleMessage(
    msg: TellMessage<any> | AskMessage<any>
  ): Promise<State> {
    await this.onReceive(msg);
    const transitions = this.transitions.get(this.state) ?? [];
    for (const transition of [...transitions, ...this.globalTransitions]) {
      if (transition.accept(msg)) {
        await transition.handle(msg);
        return transition.to ?? this.state;
      }
    }
    return await this.handleUnknownMessage(msg);
  }

  protected async handleUnknownMessage(
    msg: TellMessage<any> | AskMessage<any>
  ): Promise<State> {
    await this.onUnknown(msg);
    return this.state;
  }

  protected async onStart(): Promise<void> {}

  protected async onReceive(
    _: TellMessage<any> | AskMessage<any>
  ): Promise<void> {}

  protected async onUnknown(
    msg: TellMessage<any> | AskMessage<any>
  ): Promise<void> {
    console.log(`Received unknown message: ${msg.topic}`);
  }

  addTransition(transition: Transition) {
    const impl = Transitions.create(transition);
    if (!impl.from) {
      this.globalTransitions.push(impl);
      return;
    }

    if (!this.transitions.has(impl.from)) {
      this.transitions.set(impl.from, []);
    }
    this.transitions.get(impl.from)!.push(impl);
  }

  addTransitions(...transitions: Transition[]) {
    for (const transition of transitions) {
      this.addTransition(transition);
    }
  }

  async call<P, R>(capacity: Capacity<P, R>, payload: P): Promise<R> {
    return await capacity.handle(payload);
  }
}
