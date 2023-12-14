import {
  Message,
  Actor as BaseActor,
  Transition,
  Conns,
  Conn
} from "@actors/core";
import gmBase from "gm";

const gm = gmBase.subClass({ imageMagick: true });

type InferenceResultPayload = {
  name: string;
  img: string;
  pred?: {
    bbox: number[];
    class: string;
    score: number;
  }[];
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

    this.addTransition({
      topic: "InferenceResult",
      handler: msg => this.onInferenceResult(msg)
    });
  }

  private onInferenceResult(msg: Message<InferenceResultPayload>) {
    const { name, img, pred, err } = msg.payload;
    if (err || !pred) {
      console.log(`[${name}] Error: ${err}`);
      return;
    }

    const generateRandomColor = () => {
      // Generate random values for red, green, and blue components
      const red = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      const green = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
      const blue = Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
    
      // Concatenate the components to form the RGB color
      const randomColor = `#${red}${green}${blue}`;
    
      return randomColor;
    }   

    const buf = Buffer.from(img, "base64");
    const pic = gm(buf);
    for (const obj of pred) {
      const p = obj.bbox;

      const color = generateRandomColor();

      pic.fill("transparent");
      pic.stroke(color, 5);
      pic.drawRectangle(p[0], p[1], p[0] + p[2], p[1] + p[3]);

      pic.fill(color);
      pic.stroke(color, 1);
      pic.fontSize(25);
      pic.drawText(p[0] + 10, p[1] + 25, obj.class);

      pic.drawText(p[0] + 10, p[1] + 50, obj.score.toFixed(2));
    }

    pic.write(`./${name}.png`, err => {
      if (err) {
        console.log(`[${name}] Error: ${err}`);
        return;
      }
      console.log(`[${name}] Inference result saved.`);
    });
  }
}

function main() {
  const conn = Conns.ws("ws://localhost:8080/ws/org.i2ec/camera-user");
  const actor = new Actor("org.i2ec:camera-user", conn);
  actor.start();
}

main();
