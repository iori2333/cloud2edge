import { WebSocket } from "ws";

import { Message, Actor as BaseActor, Transition } from "@actors/core";

type ActorState = "Default";
const DEFAULT_STATE: ActorState = "Default";

export class Actor extends BaseActor<ActorState> {
  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.addTransition(
      new Transition("update", "Default", "Default", this.update.bind(this))
    );
  }

  private setLed(on: boolean): void {
    console.log(`LED is ${on ? "on" : "off"}.`);
  }

  private update(msg: Message): void {
    const payload: { aqi: number } = msg.value;
    this.setLed(payload.aqi > 100);
  }
}

function main() {
  const ws = new WebSocket("ws://ditto:ditto@localhost:31181/ws/2");

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

  const actor = new Actor("org.i2ec:led-indicator", ws);
  actor.start();
}

main();
