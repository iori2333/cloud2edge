import {
  Actor as BaseActor,
  Capacities,
  Conn,
  Message,
  Output,
  Transition,
  Conns
} from "@actors/core";
import { capture as captureCapacity } from "./webcam";

type SwitchPayload = {
  interval?: number;
};
type SwitchTransition = Transition<"Switch", ActorState, SwitchPayload>;

type InferencePayload = {
  name: string;
  img: string;
  format: string;
};
type Inference = Output<
  "org.i2ec:camera-scheduler",
  "Inference",
  InferencePayload
>;

type ActorState = "On" | "Off";
type ActorTransition = SwitchTransition;
type ActorOutput = Inference;

const DEFAULT_STATE: ActorState = "On";
const capture = Capacities.withResultMapper(
  captureCapacity,
  (res): Inference => ({
    to: "org.i2ec:camera-scheduler",
    topic: "Inference",
    payload: {
      name: `img-${Date.now()}`,
      img: res.img,
      format: res.format
    }
  })
);

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  capture: NodeJS.Timeout | null = null;

  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE);

    this.addTransition({
      topic: "Switch",
      from: "Off",
      to: "On",
      handler: msg => this.onSwitch(msg)
    });

    this.addTransition({
      topic: "Switch",
      from: "On",
      to: "Off",
      handler: msg => this.onSwitch(msg)
    });
  }

  protected async onStart(): Promise<void> {
    this.capture = setInterval(() => this.captureImage(), 500);
  }

  private onSwitch(msg: Message<SwitchPayload>) {
    if (this.capture) {
      clearInterval(this.capture);
      this.capture = null;
      return;
    }
    const { interval } = msg.payload;
    this.capture = setInterval(() => this.captureImage(), interval ?? 5000);
  }

  private captureImage() {
    this.call(capture, null)
      .then(res => {
        console.log(`Captured image ${res.payload.name}`);
        this.tell(res);
      })
      .catch(err => console.log(`Failed to capture image: ${err}`));
  }
}

function main() {
  const conn = Conns.ws("ws://localhost:8080/ws/org.i2ec/camera");
  const actor = new Actor("org.i2ec:camera", conn);
  actor.start();
}

main();
