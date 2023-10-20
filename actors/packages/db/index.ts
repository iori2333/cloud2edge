import { WebSocket } from "ws";

import { Message, Actor as BaseActor, Transition } from "@actors/core";

type ActorState = "On" | "Off";
const DEFAULT_STATE: ActorState = "On";

type UpdatePayload = {
  timestamp: number;
  power: "on" | "off";
  aqi: number;
  humidity: number;
  led: "on" | "off";
}

type QueryPayload = {
  start?: number;
  end?: number;
  limit?: number;
  offset?: number;
}

type SwitchPayload = null;

export class Actor extends BaseActor<ActorState> {
  messages: string[];

  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.messages = [];
    this.addTransitions(
      new Transition("switch", "Off", "On"),
      new Transition("switch", "On", "Off"),
      new Transition("update", "On", "On", msg => this.update(msg)),
      new Transition("query", "On", "On", msg => this.query(msg)),
      new Transition("query", "Off", "Off", msg => this.query(msg))
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

    const response = msg.respond(filtered);
    this.tell(response);
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
