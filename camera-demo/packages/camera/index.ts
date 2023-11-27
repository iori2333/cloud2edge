import * as webcam from "node-webcam";

import {
  Actor as BaseActor,
  Conn,
  Message,
  Output,
  Transition,
  WebsocketConn
} from "@actors/core";

type SwitchPayload = {
  interval?: number;
};
type SwitchTransition = Transition<"Switch", ActorState, SwitchPayload>;

type InferencePayload = {
  name: string;
  img: string;
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

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  capture: NodeJS.Timeout | null = null;
  cam: webcam.Webcam;

  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE);

    webcam.list(cams => {
      console.log(`Receving ${cams.length} cameras, using ${cams[0]}`);
    });

    this.cam = webcam.create({
      callbackReturn: "base64",
      verbose: false,
      output: "png"
    });

    this.addTransitions(
      new Transition("Switch", {
        from: "Off",
        to: "On",
        handler: this.onSwitch.bind(this)
      }),
      new Transition("Switch", {
        from: "On",
        to: "Off",
        handler: this.onSwitch.bind(this)
      })
    );
  }

  protected async onStart(): Promise<void> {
    this.capture = setInterval(() => this.captureImage(), 1000);
  }

  private onSwitch(msg: Message<SwitchPayload>) {
    if (this.capture) {
      clearInterval(this.capture);
      this.capture = null;
      return;
    }
    const { interval } = msg.value;
    this.capture = setInterval(() => this.captureImage(), interval ?? 5000);
  }

  private captureImage() {
    this.cam.capture("/tmp/output", (err, data) => {
      if (err || typeof data != "string") {
        console.log(`Failed to capture image: ${err}`);
        return;
      }

      const name = `image-${Date.now()}`;
      console.log(`Captured image ${name}`);
      this.tell({
        to: "org.i2ec:camera-scheduler",
        topic: "Inference",
        payload: { name, img: "" }
      });
    });
  }
}

function main() {
  const ws = new WebsocketConn("ws://ditto:ditto@localhost:32728/ws/2");
  const actor = new Actor("org.i2ec:camera", ws);
  actor.start();
}

main();
