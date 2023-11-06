import { WebSocket } from "ws";

import { Output, GroupRouter, RandomRouting, Message } from "@actors/core";

type SendPayload = {
  dst: string;
  msg: string;
};
type Send = Output<"org.i2ec:link", "send", SendPayload>;

type PingPayload = {
  replyTo: string;
};
type Ping = Output<"org.i2ec:link", "ping", PingPayload>;

type ActorState = "Off" | "On";
type ActorOutput = Send | Ping;
type ActorTransition = never;

const DEFAULT_STATE: ActorState = "On";

class Actor extends GroupRouter<ActorState, ActorTransition, ActorOutput> {
  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE, new RandomRouting());
  }

  override onReceive(msg: Message<any>): void {
    console.log(`Received message: ${JSON.stringify(msg)}`);
  }

  protected override async onStart(): Promise<void> {
    setInterval(() => {
      this.tell({
        to: "org.i2ec:link",
        topic: "send",
        payload: {
          dst: "org.i2ec:gateway-2",
          msg: "hello"
        }
      });
      this.broadcast({
        to: "org.i2ec:link",
        topic: "ping",
        payload: {
          replyTo: this.thingId
        }
      });
    }, 5000);
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

  const actor = new Actor("org.i2ec:gateway", ws);
  actor.start();
}

main();
