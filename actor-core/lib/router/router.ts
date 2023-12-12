import { Actor, AnyOutput, AnyTransition } from "../actor";
import { Conn } from "../connections";

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
  Output extends AnyOutput,
  Selector extends RoutingLogic = RoutingLogic
> extends Actor<State, Transition, Output> {
  children: Map<string, string[]>;
  logic: Selector;

  constructor(
    thingId: string,
    conn: Conn,
    default_state: State,
    logic: Selector
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

  override async tell(msg: Output): Promise<void> {
    const candidates = this.children.get(msg.to) || [];
    if (candidates.length == 0) {
      return await super.tell(msg);
    }

    const to = this.logic.select(msg.to, candidates);
    await super.tell({ ...msg, to });
  }

  async broadcast(msg: Output): Promise<void> {
    const proxies = this.children.get(msg.to) || [];
    if (proxies.length == 0) {
      return await super.tell(msg);
    }

    for (const proxy of proxies) {
      await super.tell({ ...msg, to: proxy });
    }
  }
}
