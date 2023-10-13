import { WebSocket } from "ws";

import {
  Message,
  Actor as BaseActor,
  MessageBuilder,
  Transition
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
    this.addTransition(new Transition("power", "On", "Off"));
    this.addTransition(new Transition("power", "Off", "On"));
    this.addTransition(new Transition("power", "Error", "Off"));
    this.addTransition(
      new Transition("query_state", "On", "On", this.queryState.bind(this))
    );
  }

  protected override onStart(): void {
    setInterval(() => {
      const msg = new MessageBuilder()
        .withDevice("org.i2ec:led-indicator")
        .withMessageName("update")
        .withPayload({ aqi: this.read_info().aqi })
        .build();
      this.ask(msg).then(r => console.log(r));
    }, 5000);
  }

  private read_info(): Info {
    return {
      aqi: Math.random() * 50 + 75,
      co2: Math.random() * 50 + 75,
      humidity: Math.random() * 50 + 75,
      pm25: Math.random() * 50 + 75
    };
  }

  private queryState(msg: Message): void {
    const payload: { fields: string[] } = msg.value;

    const send: Partial<Info> = {};
    const info = this.read_info();
    for (const field of payload.fields) {
      if (field in info) {
        const field_ = field as keyof Info;
        send[field_] = info[field_];
      }
    }

    const resp = msg.respond(send, 200);
    this.tell(resp);
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

  const actor = new Actor("org.i2ec:air-purifier", ws);
  actor.start();
}

main();
