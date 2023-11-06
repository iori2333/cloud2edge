import { WebSocket } from "ws";
import { Actor, AnyOutput, AnyTransition } from "../actor";

export interface RoutingLogic {
  select(to: string, candidates: string[]): string;
}

export class RoundRobinRouting implements RoutingLogic {
  private index = 0;

  select(to: string, candidates: string[]): string {
    const selected = candidates[this.index];
    this.index = (this.index + 1) % candidates.length;
    return selected;
  }
}

export class RandomRouting implements RoutingLogic {
  select(to: string, candidates: string[]): string {
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

export class Router<
  State extends string,
  Transition extends AnyTransition<State>,
  Output extends AnyOutput
> extends Actor<State, Transition, Output> {
  children: Map<string, string[]>;
  logic: RoutingLogic;

  constructor(
    thingId: string,
    conn: WebSocket,
    default_state: State,
    logic: RoutingLogic
  ) {
    super(thingId, conn, default_state);
    this.children = new Map();
    this.logic = logic;
  }

  register<O extends Output["to"]>(s: O, proxy: string): void {
    if (!this.children.has(s)) {
      this.children.set(s, []);
    }
    this.children.get(s)?.push(proxy);
  }

  unregister<O extends Output["to"]>(s: O, proxy: string): void {
    if (!this.children.has(s)) {
      return;
    }
    const proxies = this.children.get(s);
    const index = proxies?.indexOf(proxy) || -1;
    if (index > -1) {
      proxies?.splice(index, 1);
    }
  }

  override tell(msg: Output): void {
    const candidates = this.children.get(msg.to) || [];
    if (candidates.length == 0) {
      return super.tell(msg);
    }

    const to = this.logic.select(msg.to, candidates);
    super.tell({ ...msg, to });
  }

  broadcast(msg: Output): void {
    const proxies = this.children.get(msg.to) || [];
    if (proxies.length == 0) {
      return super.tell(msg);
    }

    for (const proxy of proxies) {
      super.tell({ ...msg, to: proxy });
    }
  }
}
