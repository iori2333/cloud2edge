import * as webcam from "node-webcam";

import {
  Actor as BaseActor,
  Conn,
  Message,
  Output,
  Transition,
  Transitions,
  WebsocketConn
} from "@actors/core";

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

class Actor extends BaseActor<ActorState, ActorTransition, ActorOutput> {
  capture: NodeJS.Timeout | null = null;
  cam: webcam.Webcam;
  i: number = 0;

  constructor(thingId: string, conn: Conn) {
    super(thingId, conn, DEFAULT_STATE);

    webcam.list(cams => {
      console.log("Available cameras:", cams);
      console.log(`Receving ${cams.length} cameras, using ${cams[1]}`);
    });

    this.cam = webcam.create({
      callbackReturn: "base64",
      device: "/dev/video0",
      verbose: false,
      output: "png"
    });

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
    this.cam.capture("/tmp/output", async (err, data) => {
      if (err || typeof data != "string") {
        console.log(`Failed to capture image: ${err}`);
        return;
      }

      const name = `image-${this.i++}`;
      const pattern = /^data:image\/(\w+);base64,/;
      console.log(`Captured image ${name}`);
      await this.tell({
        to: "org.i2ec:camera-scheduler",
        topic: "Inference",
        payload: { name, img: data.replace(pattern, ""), format: "png" }
      });
    });
  }
}

function main() {
  const ws = new WebsocketConn("ws://localhost:8080/ws/org.i2ec/camera");
  const actor = new Actor("org.i2ec:camera", ws);
  actor.start();
}

main();
