import { WebSocket } from "ws";
import { Message, Actor as BaseActor, Transition } from "@actors/core";

type UpdatePayload = {
  timestamp: number;
  power: "on" | "off";
  aqi: number;
  humidity: number;
  led: "on" | "off";
};
type UpdateTransition = Transition<"update", ActorState, UpdatePayload>;

type QueryPayload = {
  start?: number;
  end?: number;
  limit?: number;
  offset?: number;
};
type QueryTransition = Transition<"query", ActorState, QueryPayload>;

type SwitchPayload = any;
type SwitchTransition = Transition<"switch", ActorState, SwitchPayload>;

type ActorState = "On" | "Off";
type ActorTransition = UpdateTransition | QueryTransition | SwitchTransition;
type ActorOutput = never;

const DEFAULT_STATE: ActorState = "On";

export class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  messages: string[];

  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.messages = [];
    this.addTransitions(
      new Transition("switch", { from: "Off", to: "On" }),
      new Transition("switch", { from: "On", to: "Off" }),
      new Transition("update", { from: "On", handler: this.update.bind(this) }),
      new Transition("query", { handler: this.query.bind(this) })
    );
  }

  private update(msg: Message<UpdatePayload>): void {
    this.messages.push(JSON.stringify(msg.value));
  }

  private query(msg: Message<QueryPayload>): void {
    const payload = msg.value;
    const start = payload.start ?? 0;
    const end = payload.end ?? Date.now();
    const limit = payload.limit ?? 100;
    const offset = payload.offset ?? 0;

    const filtered = this.messages
      .map(msg => JSON.parse(msg))
      .filter(msg => msg.timestamp >= start && msg.timestamp <= end)
      .slice(offset, offset + limit);

    this.respond(msg, filtered);
  }
}

function main() {
  const ws = new WebSocket("ws://ditto:ditto@localhost:32728/ws/2");

  ws.on("error", err => {
    console.log(`Failed to connect: ${err}`);
  });

  ws.on("open", () => {
    console.log(`Successfully connected to ${ws.url}`);
    ws.send("START-SEND-MESSAGES");
    ws.send("START-SEND-LIVE-COMMANDS");
  });

  ws.on("close", (code, reason) => {
    console.log(`Connection closed: ${code}, ${reason.toString()}`);
  });

  const actor = new Actor("org.i2ec:purifier-db", ws);
  actor.start();
}

main();
