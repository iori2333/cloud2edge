import { WebSocket } from "ws";

import {
  Message,
  LIVE_COMMAND,
  Actor as BaseActor,
  MessageBuilder
} from "@actors/core";

type ActorState = "Off" | "On" | "Error";
const DEFAULT_STATE: ActorState = "Off";

interface Info {
  aqi: number;
  co2: number;
  humidity: number;
  pm25: number;
}

class Actor extends BaseActor<ActorState> {
  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
  }

  protected override onStart(): void {
    setInterval(() => {
      const msg = new MessageBuilder()
        .withDevice("org.i2ec:led-indicator")
        .withMessageName("update")
        .withPayload({ aqi: this.info.aqi })
        .build();
      this.tell(msg);
    }, 5000);
  }

  private get info(): Info {
    return {
      aqi: Math.random() * 50 + 75,
      co2: Math.random() * 50 + 75,
      humidity: Math.random() * 50 + 75,
      pm25: Math.random() * 50 + 75
    };
  }

  protected override handleMessage(topic: string, msg: Message): ActorState {
    switch (this.state) {
      case "Off":
        return this.onStateOff(topic, msg);
      case "On":
        return this.onStateOn(topic, msg);
      case "Error":
        return this.onStateError(topic, msg);
      default:
        return this.handleUnknownMessage(msg);
    }
  }

  private onStateOff(topic: string, msg: Message): ActorState {
    switch (topic) {
      case LIVE_COMMAND + "power": {
        const payload: { power: "on" | "off" } = msg.value;
        if (payload.power == "on") {
          return "On";
        }
        break;
      }
      default:
        this.handleUnknownMessage(msg);
    }
    return this.state;
  }

  private onStateOn(topic: string, msg: Message): ActorState {
    switch (topic) {
      case LIVE_COMMAND + "power": {
        const payload: { power: "on" | "off" } = msg.value;

        if (payload.power == "off") {
          return "Off";
        }

        break;
      }
      case LIVE_COMMAND + "query_state": {
        const payload: { fields: string[] } = msg.value;

        const send: Partial<Info> = {};
        for (const field of payload.fields) {
          const info = this.info;
          if (field in info) {
            const field_ = field as keyof Info;
            send[field_] = info[field_];
          }
        }

        const resp = msg.respond(send, 200);
        this.tell(resp);
        break;
      }
      default:
        this.handleUnknownMessage(msg);
    }
    return this.state;
  }

  private onStateError(topic: string, msg: Message): ActorState {
    switch (topic) {
      case LIVE_COMMAND + "power": {
        const payload: { power: "on" | "off" } = msg.value;

        if (payload.power == "off") {
          return "Off";
        }
        if (payload.power == "on") {
          return "On";
        }

        break;
      }
      case LIVE_COMMAND + "query_state": {
        const payload: { fields: string[] } = msg.value;

        const resp = msg.respond("Error!", 200);
        this.tell(resp);
        break;
      }
      default:
        this.handleUnknownMessage(msg);
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

  const actor = new Actor("org.i2ec:air-purifier", ws);
  actor.start();
}

main();
