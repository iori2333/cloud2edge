import {
  AnyOutput,
  AnyTransition,
  Transition,
  Message,
  Output
} from "../actor";
import { Router, RoutingLogic } from "./router";
import { Conn } from "../connections";

type RegisterPayload = {
  actorRef: string;
  proxy: string;
};

type Register<S> = Transition<"register", S, RegisterPayload>;

type UnregisterPayload = {
  actorRef: string;
  proxy: string;
};

type Unregister<S> = Transition<"unregister", S, UnregisterPayload>;

type RouterTransitions<S> = Register<S> | Unregister<S>;

export class GroupRouter<
  State extends string,
  Transition extends AnyTransition<State>,
  Output extends AnyOutput,
  Selector extends RoutingLogic = RoutingLogic
> extends Router<
  State,
  Transition | RouterTransitions<State>,
  Output,
  Selector
> {
  constructor(
    thingId: string,
    conn: Conn,
    default_state: State,
    logic: Selector
  ) {
    super(thingId, conn, default_state, logic);

    this.addTransition({
      topic: "register",
      handler: this.onRegister.bind(this)
    });

    this.addTransition({
      topic: "unregister",
      handler: this.onUnregister.bind(this)
    });
  }

  async onRegister(msg: Message<RegisterPayload>) {
    const { actorRef, proxy } = msg.payload;
    this.register(proxy, actorRef);
  }

  async onUnregister(msg: Message<UnregisterPayload>) {
    const { actorRef, proxy } = msg.payload;
    this.unregister(proxy, actorRef);
  }
}

export type RegisterOutput<R extends string> = Output<
  R,
  "register",
  RegisterPayload
>;

export type UnregisterOutput<R extends string> = Output<
  R,
  "unregister",
  UnregisterPayload
>;
