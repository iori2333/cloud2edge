import {
  Message,
  Actor as BaseActor,
  Transition,
  WebsocketConn,
  Conn
} from "@actors/core";
import { writeFileSync } from "fs";

type InferenceResultPayload = {
  name: string;
  data?: string;
  err?: string;
};

type InferenceResultTransition = Transition<
  "InferenceResult",
  ActorState,
  InferenceResultPayload
>;

type ActorState = "Default";
type ActorTransition = InferenceResultTransition;
type ActorOutput = never;

const DEFAULT_STATE: ActorState = "Default";

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE);

    this.addTransitions(
      new Transition("InferenceResult", {
        handler: this.onInferenceResult.bind(this)
      })
    );
  }

  private onInferenceResult(msg: Message<InferenceResultPayload>) {
    const { name, data, err } = msg.value;
    if (err || !data) {
      console.log(`[${name}] Error: ${err}`);
      return;
    }

    const pic = data.split(",")[1];
    const buf = Buffer.from(pic, "base64");
    writeFileSync(`./${name}.png`, buf);
    console.log(`[${name}] Inference result saved to ${name}.png`);
  }
}

function main() {
  const ws = new WebsocketConn("ws://ditto:ditto@localhost:32728/ws/2");

  const actor = new Actor("org.i2ec:camera-user", ws);
  actor.start();
}

main();
