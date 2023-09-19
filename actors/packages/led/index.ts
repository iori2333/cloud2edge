import { WebSocket } from "ws";

import { Message, LIVE_COMMAND, Actor as BaseActor } from "@actors/core";

type ActorState = "Default";
const DEFAULT_STATE: ActorState = "Default";

export class Actor extends BaseActor<ActorState> {
  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
  }

  private setLed(on: boolean): void {
    console.log(`LED is ${on ? "on" : "off"}.`);
  }

  protected override handleMessage(topic: string, msg: Message): ActorState {
    switch (this.state) {
      case "Default":
        return this.onStateDefault(topic, msg);
      default:
        return this.handleUnknownMessage(msg);
    }
  }

  private onStateDefault(topic: string, msg: Message): ActorState {
    switch (topic) {
      case LIVE_COMMAND + "update": {
        const payload: { aqi: number } = msg.value;
        this.setLed(payload.aqi > 100);
        return this.state;
      }
    }
    return this.state;
  }
}

function main() {
  const ws = new WebSocket("ws://ditto:ditto@localhost:32747/ws/2");

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
