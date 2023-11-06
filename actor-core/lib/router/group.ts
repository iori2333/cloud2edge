import WebSocket from "ws";
import {
  AnyOutput,
  AnyTransition,
  Transition,
  Message,
  Output
} from "../actor";
import { Router, RoutingLogic } from "./router";

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
  Output extends AnyOutput
> extends Router<State, Transition | RouterTransitions<State>, Output> {
  constructor(
    thingId: string,
    conn: WebSocket,
    default_state: State,
    logic: RoutingLogic
  ) {
    super(thingId, conn, default_state, logic);
    this.addTransitions(
      new Transition("register", { handler: this.onRegister.bind(this) }),
      new Transition("unregister", { handler: this.onUnregister.bind(this) })
    );
  }

  onRegister(msg: Message<RegisterPayload>): void {
    const { actorRef, proxy } = msg.value;
    this.register(proxy, actorRef);
  }

  onUnregister(msg: Message<UnregisterPayload>): void {
    const { actorRef, proxy } = msg.value;
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
