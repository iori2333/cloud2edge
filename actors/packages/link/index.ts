import { WebSocket } from "ws";

import {
  Message,
  Actor as BaseActor,
  Output,
  Transition,
  RegisterOutput
} from "@actors/core";

type SendPayload = {
  dst: string;
  msg: string;
};
type SendTransition = Transition<"send", ActorState, SendPayload>;

type PingPayload = {
  replyTo: string;
};
type PingTransition = Transition<"ping", ActorState, PingPayload>;

type ActorState = "Off" | "On" | "Error";
type ActorOutput = RegisterOutput<"org.i2ec:gateway">;
type ActorTransition = SendTransition | PingTransition;

const DEFAULT_STATE: ActorState = "On";

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  constructor(thingId: string, conn: WebSocket) {
    super(thingId, conn, DEFAULT_STATE);
    this.addTransitions(
      new Transition("send", {
        from: "On",
        handler: this.onSend.bind(this)
      })
    );
    this.addTransitions(
      new Transition("ping", {
        from: "On",
        handler: this.onPing.bind(this)
      })
    );
  }

  protected override async onStart(): Promise<void> {
    setTimeout(() => {
      this.tell({
        to: "org.i2ec:gateway",
        topic: "register",
        payload: {
          actorRef: this.thingId,
          proxy: "org.i2ec:link"
        }
      });
    }, 2000);
  }

  private onSend(msg: Message<SendPayload>): void {
    console.log(`${this.thingId}:`, msg.value);
  }

  private onPing(msg: Message<PingPayload>): void {
    console.log(`${this.thingId}: pong!`);
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

  const actors = [
    new Actor("org.i2ec:link-1", ws),
    new Actor("org.i2ec:link-2", ws),
    new Actor("org.i2ec:link-3", ws)
  ];
  actors.forEach(actor => actor.start());
}

main();
